import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/core/prisma/prisma.service';
import { PollEventsService } from '@/modules/quack/services/poll-events.service';
import { filter, firstValueFrom, timeout } from 'rxjs';
import { PollRepository } from './poll.repository';
import { QuackRepository } from './quack.repository';

const databaseDescribe =
  process.env.POLL_DB_TESTS === '1' ? describe : describe.skip;
databaseDescribe('Replies and irreversible erasure (PostgreSQL)', () => {
  let db: PrismaService;
  let quacks: QuackRepository;
  let polls: PollRepository;
  let listener: PollEventsService;
  const userIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  beforeAll(async () => {
    db = new PrismaService();
    await db.$connect();
    quacks = new QuackRepository(db);
    polls = new PollRepository(db);
    listener = new PollEventsService();
    await listener.onModuleInit();
    await db.user.createMany({
      data: userIds.map((id) => ({
        id,
        name: 'Reply test',
        email: `${id}@example.invalid`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
  });
  afterAll(async () => {
    for (const id of userIds)
      if (await db.user.findUnique({ where: { id } }))
        await quacks.deleteAccount(id);
    await listener.onModuleDestroy();
    await db.$disconnect();
  });
  it('preserves indirect replies and their polls when removing a root and parent', async () => {
    const root = await quacks.createQuack({
      userId: userIds[0],
      text: 'secret root',
      mood: 'happy',
      poll: { question: 'Root?', options: ['A', 'B'] },
    });
    const parent = await quacks.createQuack({
      userId: userIds[0],
      text: 'secret parent',
      parentId: root.id,
    });
    const child = await quacks.createQuack({
      userId: userIds[1],
      text: 'My independent reply',
      parentId: parent.id,
      poll: { question: 'Child?', options: ['Yes', 'No'] },
    });
    const event = firstValueFrom(
      listener.events().pipe(
        filter(
          (e) =>
            e.type === 'quack-erased' &&
            (e.data as { quackId: string }).quackId === root.id,
        ),
        timeout(2000),
      ),
    );
    await quacks.deleteQuack(root.id, userIds[0]);
    expect((await event).data).toEqual(
      expect.objectContaining({ quackId: root.id, rootId: root.id }),
    );
    await quacks.deleteQuack(parent.id, userIds[0]);
    const erased = await quacks.getQuack(root.id, userIds[1]);
    expect(erased).toMatchObject({
      text: null,
      mood: null,
      userId: null,
      user: null,
      poll: null,
      replyCount: 1,
    });
    expect(erased.deletedAt).toBeInstanceOf(Date);
    expect(await db.poll.count({ where: { quackId: root.id } })).toBe(0);
    expect((await quacks.getQuack(child.id, userIds[1])).parent).toMatchObject({
      id: parent.id,
      user: null,
      text: null,
    });
    expect((await quacks.getQuack(child.id, userIds[1])).poll).not.toBeNull();
    expect(
      (await quacks.getQuacks(userIds[1])).some((q) => q.id === root.id),
    ).toBe(true);
    expect(
      (await quacks.getQuacks(userIds[1], 'all', true)).some(
        (q) => q.id === root.id,
      ),
    ).toBe(false);
    await quacks.deleteQuack(child.id, userIds[1]);
    expect(
      (await quacks.getQuacks(userIds[1])).some((q) => q.id === root.id),
    ).toBe(false);
    const continued = await quacks.createQuack({
      userId: userIds[1],
      text: 'Continue',
      parentId: parent.id,
    });
    expect(continued.rootId).toBe(root.id);
    expect(
      (await quacks.getQuacks(userIds[1])).some((q) => q.id === root.id),
    ).toBe(true);
  });
  it('paginates 21 replies including a tombstone, and jumps directly to a target', async () => {
    const root = await quacks.createQuack({
      userId: userIds[0],
      text: 'Pagination',
    });
    const replies: import('@/modules/quack/domain/quack').Quack[] = [];
    for (let n = 0; n < 21; n++)
      replies.push(
        await quacks.createQuack({
          userId: userIds[1],
          text: `Reply ${n}`,
          parentId: root.id,
        }),
      );
    await quacks.deleteQuack(replies[5].id, userIds[1]);
    const first = await quacks.getReplies(root.id, userIds[0]);
    expect(first.items).toHaveLength(20);
    expect(first.items.some((q) => q.id === replies[5].id && q.deletedAt)).toBe(
      true,
    );
    const second = await quacks.getReplies(
      root.id,
      userIds[0],
      first.nextCursor!,
    );
    expect(second.items.map((q) => q.id)).toEqual([replies[20].id]);
    expect(second.nextCursor).toBeNull();
    expect(
      (
        await quacks.getReplies(root.id, userIds[0], undefined, replies[20].id)
      ).items.map((q) => q.id),
    ).toEqual([replies[20].id]);
    expect((await quacks.getQuack(root.id, userIds[0])).replyCount).toBe(20);
    await expect(
      quacks.getReplies(root.id, userIds[0], root.id),
    ).rejects.toThrow('Reply does not belong');
  });
  it('rejects invalid direct writes, physical deletion, restoration and polls on tombstones', async () => {
    const root = await quacks.createQuack({
      userId: userIds[0],
      text: 'Integrity',
    });
    const other = await quacks.createQuack({
      userId: userIds[0],
      text: 'Other root',
    });
    await expect(
      db.quack.create({
        data: {
          userId: userIds[0],
          text: 'Wrong root',
          parentId: root.id,
          rootId: other.id,
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      db.quack.update({
        where: { id: root.id },
        data: { parentId: other.id, rootId: other.id },
      }),
    ).rejects.toBeDefined();
    await expect(
      db.$executeRaw`TRUNCATE TABLE quack CASCADE`,
    ).rejects.toBeDefined();
    await expect(
      db.quack.delete({ where: { id: root.id } }),
    ).rejects.toBeDefined();
    await expect(
      db.user.delete({ where: { id: userIds[0] } }),
    ).rejects.toBeDefined();
    await quacks.deleteQuack(root.id, userIds[0]);
    await expect(
      db.quack.update({
        where: { id: root.id },
        data: { text: 'Restored', userId: userIds[0], deletedAt: null },
      }),
    ).rejects.toBeDefined();
    await expect(
      db.poll.create({ data: { quackId: root.id, question: 'Forbidden' } }),
    ).rejects.toBeDefined();
    await quacks.deleteQuack(root.id, userIds[1]);
  });
  it('serializes erasure and voting without retaining the erased poll', async () => {
    const root = await quacks.createQuack({
      userId: userIds[0],
      text: 'Race',
      poll: { question: 'Q?', options: ['A', 'B'] },
    });
    const option = root.poll!.options[0].id;
    const results = await Promise.allSettled([
      polls.vote(root.id, userIds[1], option),
      quacks.deleteQuack(root.id, userIds[0]),
    ]);
    expect(results[1].status).toBe('fulfilled');
    expect(await db.poll.count({ where: { quackId: root.id } })).toBe(0);
    expect((await quacks.getQuack(root.id, userIds[1])).text).toBeNull();
  });
  it('erases an account without erasing other authors and updates surviving poll totals', async () => {
    const owned = await quacks.createQuack({
      userId: userIds[2],
      text: 'Account secret',
    });
    const child = await quacks.createQuack({
      userId: userIds[1],
      text: 'Keep me',
      parentId: owned.id,
    });
    const surviving = await quacks.createQuack({
      userId: userIds[1],
      text: 'Poll remains',
      poll: { question: 'Q?', options: ['A', 'B'] },
    });
    await polls.vote(surviving.id, userIds[2], surviving.poll!.options[0].id);
    await quacks.deleteAccount(userIds[2]);
    expect(await db.user.findUnique({ where: { id: userIds[2] } })).toBeNull();
    expect(
      await db.pollVoterUsage.findUnique({ where: { userId: userIds[2] } }),
    ).toBeNull();
    expect((await quacks.getQuack(owned.id, userIds[1])).user).toBeNull();
    expect((await quacks.getQuack(child.id, userIds[1])).text).toBe('Keep me');
    expect(
      (await quacks.getQuack(surviving.id, userIds[1])).poll,
    ).toMatchObject({ totalVotes: 0, revision: 2 });
  });
  it('serializes account deletion with publication without leaving a live orphan', async () => {
    const result = await Promise.allSettled([
      quacks.createQuack({
        userId: userIds[3],
        text: 'Racing account content',
      }),
      quacks.deleteAccount(userIds[3]),
    ]);
    expect(result[1].status).toBe('fulfilled');
    expect(await db.quack.count({ where: { userId: userIds[3] } })).toBe(0);
    if (result[0].status === 'fulfilled') {
      expect(
        (await quacks.getQuack(result[0].value.id, userIds[0])).text,
      ).toBeNull();
    }
  });

  it('serializes direct poll insertion with erasure using the database trigger', async () => {
    const root = await quacks.createQuack({
      userId: userIds[0],
      text: 'Direct poll race',
    });
    const result = await Promise.allSettled([
      db.poll.create({ data: { quackId: root.id, question: 'Racing poll' } }),
      quacks.deleteQuack(root.id, userIds[0]),
    ]);
    expect(result[1].status).toBe('fulfilled');
    expect((await quacks.getQuack(root.id, userIds[0])).text).toBeNull();
    expect(await db.poll.count({ where: { quackId: root.id } })).toBe(0);
  });
});
