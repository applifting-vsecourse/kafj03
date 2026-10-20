import { PollsController } from '@/modules/quack/controllers/polls.controller';
import { PollEventsService } from '@/modules/quack/services/poll-events.service';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { generatePollReport } from '@/scripts/polls/poll-report';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import { Test } from '@nestjs/testing';
import { filter, firstValueFrom, timeout } from 'rxjs';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/core/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PollRepository } from './poll.repository';
import { QuackRepository } from './quack.repository';

jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

// Explicit opt-in: writes isolated fixtures to the configured local database.
const databaseDescribe =
  process.env.POLL_DB_TESTS === '1' ? describe : describe.skip;

databaseDescribe('Poll repository (PostgreSQL)', () => {
  let prisma: PrismaService;
  let listeners: PollEventsService[];
  let polls: PollRepository;
  let quacks: QuackRepository;
  const users = Array.from({ length: 12 }, () => `poll-test-${randomUUID()}`);
  const quackIds: string[] = [];
  const pollIds: string[] = [];
  const reportUserIds: string[] = [];
  let quackId: string;
  let pollId: string;
  let options: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    listeners = [new PollEventsService(), new PollEventsService()];
    await Promise.all(listeners.map((listener) => listener.onModuleInit()));
    polls = new PollRepository(prisma);
    quacks = new QuackRepository(prisma);
    await prisma.user.createMany({
      data: users.map((id) => ({
        id,
        name: 'Poll test',
        email: `${id}@example.invalid`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
  });

  beforeEach(async () => {
    const quack = await quacks.createQuack({
      text: 'Integration test',
      userId: users[0],
      poll: { question: 'Lunch?', options: ['Pizza', 'Soup'] },
    });
    quackId = quack.id;
    quackIds.push(quackId);
    const poll = await prisma.poll.findUniqueOrThrow({
      where: { quackId },
      include: { options: { orderBy: { position: 'asc' } } },
    });
    pollId = poll.id;
    pollIds.push(pollId);
    options = poll.options.map((option) => option.id);
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.quack.deleteMany({ where: { id: { in: quackIds } } });
      await prisma.pollUsage.deleteMany({ where: { pollId: { in: pollIds } } });
      await prisma.pollVoterUsage.deleteMany({
        where: { userId: { in: [...users, ...reportUserIds] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    } finally {
      await Promise.all(
        listeners.map((listener) => listener.onModuleDestroy()),
      );
      await prisma.$disconnect();
    }
  });

  it('streams a committed vote over HTTP SSE within two seconds', async () => {
    const module = await Test.createTestingModule({
      controllers: [PollsController],
      providers: [
        { provide: PollRepository, useValue: polls },
        { provide: PollEventsService, useValue: listeners[0] },
      ],
    })
      .overrideGuard(AuthenticatedUserGuard)
      .useValue({ canActivate: () => true })
      .compile();
    // Avoid owning the shared listener's lifecycle in this temporary HTTP server.
    const listenerInit = jest
      .spyOn(listeners[0], 'onModuleInit')
      .mockResolvedValue();
    const listenerDestroy = jest
      .spyOn(listeners[0], 'onModuleDestroy')
      .mockResolvedValue();
    const app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), 2000);
    try {
      await app.listen(0, '127.0.0.1');
      const response = await fetch(
        `${await app.getUrl()}/api/quacks/polls/events`,
        { signal: abort.signal },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(
        'text/event-stream',
      );
      expect(response.headers.get('x-accel-buffering')).toBe('no');
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let received = '';
      while (!received.includes('event: ready')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('SSE closed before ready');
        received += decoder.decode(chunk.value);
      }
      const startedAt = Date.now();
      await polls.vote(quackId, users[0], options[0]);
      while (
        !received.includes('event: poll-changed') ||
        !received.includes(quackId)
      ) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('SSE closed before vote');
        received += decoder.decode(chunk.value);
      }
      expect(Date.now() - startedAt).toBeLessThan(2000);
      await reader.cancel();
    } finally {
      clearTimeout(deadline);
      abort.abort();
      await app.close();
      listenerInit.mockRestore();
      listenerDestroy.mockRestore();
    }
  });

  it('delivers committed changes to two independent listeners within two seconds', async () => {
    const messages = listeners.map((listener) =>
      firstValueFrom(
        listener.events().pipe(
          filter(
            (event) =>
              event.type === 'poll-changed' &&
              (event.data as { quackId?: string }).quackId === quackId,
          ),
          timeout(2000),
        ),
      ),
    );
    const saved = await polls.vote(quackId, users[0], options[0]);
    const received = await Promise.all(messages);
    expect(received.map((event) => event.data)).toEqual([
      { quackId, revision: saved.revision },
      { quackId, revision: saved.revision },
    ]);
    expect((await quacks.getQuack(quackId, users[1])).poll?.totalVotes).toBe(1);
  });

  it('does not deliver notifications for rolled back transactions', async () => {
    const events: unknown[] = [];
    const subscription = listeners[0].events().subscribe((event) => {
      if (
        event.type === 'poll-changed' &&
        (event.data as { quackId?: string }).quackId === quackId
      )
        events.push(event.data);
    });
    try {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_notify('quack_poll_changed', ${JSON.stringify({ quackId, revision: 99 })})`;
          throw new Error('Rollback');
        }),
      ).rejects.toThrow('Rollback');
      // A subsequent committed notification is a barrier on the same channel.
      const received = firstValueFrom(
        listeners[0].events().pipe(
          filter(
            (event) =>
              event.type === 'poll-changed' &&
              (event.data as { quackId?: string }).quackId === quackId,
          ),
          timeout(2000),
        ),
      );
      await polls.vote(quackId, users[0], options[0]);
      await received;
      expect(events).toEqual([{ quackId, revision: 1 }]);
    } finally {
      subscription.unsubscribe();
    }
  });

  it('creates options in order and records publication without a first vote', async () => {
    expect(
      await prisma.pollOption.findMany({
        where: { pollId },
        orderBy: { position: 'asc' },
      }),
    ).toEqual([
      expect.objectContaining({ text: 'Pizza', position: 0 }),
      expect.objectContaining({ text: 'Soup', position: 1 }),
    ]);
    expect(await prisma.pollUsage.findUnique({ where: { pollId } })).toEqual(
      expect.objectContaining({ firstVotedAt: null }),
    );
  });

  it('serializes concurrent duplicate votes by the same user', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        polls.vote(quackId, users[0], options[0]),
      ),
    );
    expect(
      results.every(
        (result) => result.totalVotes === 1 && result.revision === 1,
      ),
    ).toBe(true);
    expect(await prisma.pollVote.count({ where: { pollId } })).toBe(1);
  });

  it('preserves votes from different users under concurrency', async () => {
    await Promise.all(
      users.map((userId, index) =>
        polls.vote(quackId, userId, options[index % 2]),
      ),
    );
    const result = await polls.vote(quackId, users[0], options[0]);
    expect(result).toMatchObject({ totalVotes: 12, revision: 12 });
    expect(
      result.options.map((option) => [option.votes, option.percentage]),
    ).toEqual([
      [6, 50],
      [6, 50],
    ]);
  });

  it('keeps the last serialized change across devices without adding voters', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        polls.vote(quackId, users[0], options[index % 2]),
      ),
    );
    const last = results.reduce((a, b) => (a.revision > b.revision ? a : b));
    const stored = await prisma.pollVote.findUniqueOrThrow({
      where: { pollId_userId: { pollId, userId: users[0] } },
    });
    expect(stored.optionId).toBe(last.myOptionId);
    const firstVote = (
      await prisma.pollUsage.findUniqueOrThrow({ where: { pollId } })
    ).firstVotedAt;
    const changed = await polls.vote(
      quackId,
      users[0],
      stored.optionId === options[0] ? options[1] : options[0],
    );
    expect(changed.totalVotes).toBe(1);
    expect(changed.options.map((option) => option.votes).sort()).toEqual([
      0, 1,
    ]);
    expect(
      (await prisma.pollUsage.findUniqueOrThrow({ where: { pollId } }))
        .firstVotedAt,
    ).toEqual(firstVote);
    expect(
      await prisma.pollVoterUsage.count({ where: { userId: users[0] } }),
    ).toBe(1);
  });

  it('rejects missing polls and foreign options without changing results', async () => {
    await expect(
      polls.vote('missing', users[0], options[0]),
    ).rejects.toBeInstanceOf(NotFoundException);
    const otherQuack = await quacks.createQuack({
      text: 'Another poll',
      userId: users[0],
      poll: { question: 'Other?', options: ['Yes', 'No'] },
    });
    quackIds.push(otherQuack.id);
    const otherPoll = await prisma.poll.findUniqueOrThrow({
      where: { quackId: otherQuack.id },
      include: { options: true },
    });
    pollIds.push(otherPoll.id);
    const foreign = otherPoll.options[0];
    await expect(
      polls.vote(quackId, users[0], foreign.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await prisma.pollVote.count({ where: { pollId } })).toBe(0);
    // The composite FK also protects writes bypassing the repository.
    await expect(
      prisma.pollVote.create({
        data: { pollId, userId: users[0], optionId: foreign.id },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rolls back the whole publication when its nested options fail', async () => {
    const before = await prisma.quack.count({ where: { userId: users[0] } });
    const usageBefore = await prisma.pollUsage.count();
    await expect(
      quacks.createQuack({
        text: 'Invalid',
        userId: users[0],
        poll: { question: 'Q', options: ['A', 'B'.repeat(101)] },
      }),
    ).rejects.toBeDefined();
    expect(await prisma.quack.count({ where: { userId: users[0] } })).toBe(
      before,
    );
    expect(await prisma.pollUsage.count()).toBe(usageBefore);
  });

  it('returns viewer-specific choices and shared totals in feed and detail', async () => {
    await polls.vote(quackId, users[0], options[0]);
    await polls.vote(quackId, users[1], options[1]);
    const mine = await quacks.getQuack(quackId, users[0]);
    const theirs = await quacks.getQuack(quackId, users[1]);
    const observer = await quacks.getQuack(quackId, users[2]);
    expect(mine.poll).toMatchObject({
      totalVotes: 2,
      revision: 2,
      myOptionId: options[0],
    });
    expect(theirs.poll?.myOptionId).toBe(options[1]);
    expect(observer.poll?.myOptionId).toBeNull();
    expect(mine.poll?.options).toEqual(theirs.poll?.options);
    expect(
      mine.poll?.options.map((option) => [option.votes, option.percentage]),
    ).toEqual([
      [1, 50],
      [1, 50],
    ]);
    const feed = await quacks.getQuacks(users[0]);
    expect(feed.find((quack) => quack.id === quackId)?.poll).toEqual(mine.poll);
    expect(Object.keys(mine.poll?.options[0] ?? {}).sort()).toEqual([
      'id',
      'percentage',
      'position',
      'text',
      'votes',
    ]);
  });

  it('returns zero results on publication and null for a plain post', async () => {
    const created = await quacks.getQuack(quackId, users[0]);
    expect(created.poll).toMatchObject({
      totalVotes: 0,
      revision: 0,
      myOptionId: null,
    });
    expect(
      created.poll?.options.every(
        (option) => option.votes === 0 && option.percentage === 0,
      ),
    ).toBe(true);
    const plain = await quacks.createQuack({
      text: 'Plain post',
      userId: users[0],
    });
    quackIds.push(plain.id);
    expect(plain.poll).toBeNull();
    expect((await quacks.getQuack(plain.id, users[1])).poll).toBeNull();
  });

  it('rejects deleting another author’s post and reports missing posts', async () => {
    await expect(
      new QuacksService(quacks).deleteQuack(
        quackId,
        new Identity(users[1], '', '', 'user'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await quacks.getQuack(quackId, users[1])).id).toBe(quackId);
    await expect(quacks.getQuack('missing', users[0])).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(quacks.deleteQuack('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reports a half-open 30-day cohort without texts or choices', async () => {
    const start = new Date('2120-01-01T00:00:00Z');
    const end = new Date('2120-01-31T00:00:00Z');
    const at = (offset: number): Date => new Date(start.getTime() + offset);
    const records = [
      { createdAt: at(-1), firstVotedAt: start },
      { createdAt: start, firstVotedAt: start },
      { createdAt: at(1), firstVotedAt: new Date(end.getTime() - 1) },
      { createdAt: new Date(end.getTime() - 1), firstVotedAt: null },
      { createdAt: at(2), firstVotedAt: end },
      { createdAt: end, firstVotedAt: end },
    ].map((record) => ({ ...record, pollId: `report-test-${randomUUID()}` }));
    pollIds.push(...records.map((record) => record.pollId));
    await prisma.pollUsage.createMany({ data: records });
    const voterRecords = [at(-1), start, new Date(end.getTime() - 1), end].map(
      (firstVotedAt) => ({
        userId: `report-test-${randomUUID()}`,
        firstVotedAt,
      }),
    );
    reportUserIds.push(...voterRecords.map((record) => record.userId));
    await prisma.pollVoterUsage.createMany({ data: voterRecords });
    const report = await generatePollReport(prisma, start, end);
    expect(report).toEqual({
      periodStart: start.toISOString(),
      periodEndExclusive: end.toISOString(),
      generatedAt: end.toISOString(),
      isComplete: true,
      createdPolls: 4,
      pollsWithVotes: 2,
      pollsWithVotesShare: 0.5,
      uniqueVoters: 2,
    });
    const emptyStart = new Date('2121-01-01T00:00:00Z');
    expect(
      await generatePollReport(
        prisma,
        emptyStart,
        new Date('2121-01-02T00:00:00Z'),
      ),
    ).toMatchObject({
      isComplete: false,
      createdPolls: 0,
      pollsWithVotes: 0,
      pollsWithVotesShare: 0,
      uniqueVoters: 0,
    });
  });

  it('cascades deletion through votes while preserving report records', async () => {
    await polls.vote(quackId, users[0], options[0]);
    const launch = new Date(Date.now() - 60_000);
    const generatedAt = new Date();
    const before = await generatePollReport(prisma, launch, generatedAt);
    await quacks.deleteQuack(quackId);
    expect(await generatePollReport(prisma, launch, generatedAt)).toEqual(
      before,
    );
    expect(await prisma.poll.count({ where: { id: pollId } })).toBe(0);
    expect(await prisma.pollOption.count({ where: { pollId } })).toBe(0);
    expect(await prisma.pollVote.count({ where: { pollId } })).toBe(0);
    expect(
      await prisma.pollUsage.findUnique({ where: { pollId } }),
    ).not.toBeNull();
    expect(
      await prisma.pollVoterUsage.findUnique({ where: { userId: users[0] } }),
    ).not.toBeNull();
  });
});
