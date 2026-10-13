import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/core/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PollRepository } from './poll.repository';
import { QuackRepository } from './quack.repository';

// Explicit opt-in: writes isolated fixtures to the configured local database.
const databaseDescribe =
  process.env.POLL_DB_TESTS === '1' ? describe : describe.skip;

databaseDescribe('Poll repository (PostgreSQL)', () => {
  let prisma: PrismaService;
  let polls: PollRepository;
  let quacks: QuackRepository;
  const users = Array.from({ length: 12 }, () => `poll-test-${randomUUID()}`);
  const quackIds: string[] = [];
  const pollIds: string[] = [];
  let quackId: string;
  let pollId: string;
  let options: string[];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
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
        where: { userId: { in: users } },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    } finally {
      await prisma.$disconnect();
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

  it('cascades deletion through votes while preserving report records', async () => {
    await polls.vote(quackId, users[0], options[0]);
    await prisma.quack.delete({ where: { id: quackId } });
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
