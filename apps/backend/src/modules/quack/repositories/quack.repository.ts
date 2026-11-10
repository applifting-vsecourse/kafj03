import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { CreatePoll } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoadedPoll, mapPollResult, pollInclude } from './poll-result';

type LoadedQuack = PrismaQuack & {
  user?: PrismaUser | null;
  poll?: LoadedPoll | null;
  parent?: (PrismaQuack & { user: PrismaUser | null }) | null;
  _count?: { threadItems: number };
};
const author = (user?: PrismaUser | null): Quack['user'] =>
  user
    ? {
        id: user.id,
        name: user.name,
        username: user.username ?? '',
      }
    : null;
const mapQuack = (q: LoadedQuack): Quack => ({
  id: q.id,
  text: q.text,
  mood: q.mood,
  userId: q.userId,
  createdAt: q.createdAt,
  updatedAt: q.updatedAt,
  deletedAt: q.deletedAt,
  parentId: q.parentId,
  rootId: q.rootId,
  user: author(q.user),
  poll: q.poll ? mapPollResult(q.poll) : null,
  replyCount: q._count?.threadItems ?? 0,
  parent:
    !q.deletedAt && q.parent
      ? {
          id: q.parent.id,
          text: q.parent.text?.slice(0, 100) ?? null,
          deletedAt: q.parent.deletedAt,
          user: author(q.parent.user) ?? null,
        }
      : null,
});
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const includeQuack = (userId?: string) =>
  ({
    user: true,
    poll: { include: pollInclude(userId) },
    parent: { include: { user: true } },
    _count: { select: { threadItems: { where: { deletedAt: null } } } },
  }) satisfies Prisma.QuackInclude;
export type ReplyPage = { items: Quack[]; nextCursor: string | null };

@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recordUsage(
    userId: string,
    event: 'feed' | 'search' | 'open',
  ): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "search_usage" ("userId", "day", "searched", "opened")
      VALUES (${userId}, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, ${event !== 'feed'}, ${event === 'open'})
      ON CONFLICT ("userId", "day") DO UPDATE SET
        "searched" = "search_usage"."searched" OR EXCLUDED."searched",
        "opened" = "search_usage"."opened" OR EXCLUDED."opened"
    `;
  }

  async getQuacks(
    userId?: string,
    scope: 'all' | 'mine' = 'all',
    searching = false,
  ): Promise<Quack[]> {
    return this.prisma.$transaction(
      async (tx) => {
        const where: Prisma.QuackWhereInput =
          scope === 'mine'
            ? { userId, deletedAt: null }
            : searching
              ? { deletedAt: null }
              : {
                  parentId: null,
                  OR: [
                    { deletedAt: null },
                    { threadItems: { some: { deletedAt: null } } },
                  ],
                };
        return (
          await tx.quack.findMany({
            where,
            include: includeQuack(userId),
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          })
        ).map(mapQuack);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async getQuack(id: string, userId: string): Promise<Quack> {
    return this.prisma.$transaction(
      async (tx) => {
        const q = await tx.quack.findUnique({
          where: { id },
          include: includeQuack(userId),
        });
        if (!q) throw new NotFoundException('Post not found');
        return mapQuack(q);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async getReplies(
    rootId: string,
    userId: string,
    cursor?: string,
    targetId?: string,
  ): Promise<ReplyPage> {
    if (cursor && targetId)
      throw new BadRequestException('Use either cursor or target');
    return this.prisma.$transaction(
      async (tx) => {
        const root = await tx.quack.findUnique({ where: { id: rootId } });
        if (!root || root.parentId)
          throw new NotFoundException('Discussion not found');
        let after: PrismaQuack | null = null;
        let skip = 0;
        if (cursor || targetId) {
          const target = await tx.quack.findUnique({
            where: { id: cursor ?? targetId },
          });
          if (!target || target.rootId !== rootId)
            throw new BadRequestException(
              'Reply does not belong to this discussion',
            );
          if (cursor) after = target;
          else {
            const before = await tx.quack.count({
              where: {
                rootId,
                OR: [
                  { createdAt: { lt: target.createdAt } },
                  { createdAt: target.createdAt, id: { lt: target.id } },
                ],
              },
            });
            skip = Math.floor(before / 20) * 20;
          }
        }
        const items = await tx.quack.findMany({
          where: {
            rootId,
            ...(after
              ? {
                  OR: [
                    { createdAt: { gt: after.createdAt } },
                    { createdAt: after.createdAt, id: { gt: after.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip,
          take: 21,
          include: includeQuack(userId),
        });
        return {
          items: items.slice(0, 20).map(mapQuack),
          nextCursor: items.length > 20 ? items[19].id : null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async getUserRole(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role ?? null;
  }

  async deleteQuack(id: string, actorId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Lock the actor before the post, also serializing role changes and account deletion.
      const actors = actorId
        ? await tx.$queryRaw<
            { role: string }[]
          >`SELECT role FROM "user" WHERE id = ${actorId} FOR UPDATE`
        : [];
      const rows = await tx.$queryRaw<
        PrismaQuack[]
      >`SELECT * FROM quack WHERE id = ${id} FOR UPDATE`;
      const q = rows[0];
      if (!q) throw new NotFoundException('Post not found');
      if (q.deletedAt) return;
      if (
        actorId &&
        (!actors[0] || (q.userId !== actorId && actors[0].role !== 'admin'))
      )
        throw new ForbiddenException(
          'You do not have permission to delete this post',
        );
      await this.erase(tx, id);
    });
  }

  private async erase(tx: Prisma.TransactionClient, id: string): Promise<void> {
    await tx.poll.deleteMany({ where: { quackId: id } });
    await tx.quack.update({
      where: { id },
      data: { text: null, mood: null, userId: null, deletedAt: new Date() },
    });
  }

  // Trusted backend operation; deliberately not exposed as a new account UI/API.
  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`;
      if (!users.length) throw new NotFoundException('Account not found');
      const owned = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM quack WHERE "userId" = ${userId} ORDER BY id`;
      // Surviving polls lose this user's votes through the existing user FK.
      const impacted = await tx.poll.findMany({
        where: { options: { some: { votes: { some: { userId } } } } },
        select: { quackId: true },
      });
      const lockIds = [
        ...new Set([
          ...owned.map((q) => q.id),
          ...impacted.map((p) => p.quackId),
        ]),
      ].sort();
      for (const id of lockIds)
        await tx.$queryRaw`SELECT id FROM quack WHERE id = ${id} FOR UPDATE`;
      for (const q of owned) await this.erase(tx, q.id);
      const affected = await tx.$queryRaw<{ id: string; quackId: string }[]>`
        SELECT p.id, p."quackId" FROM poll p
        WHERE EXISTS (SELECT 1 FROM poll_vote v WHERE v."pollId" = p.id AND v."userId" = ${userId})
        ORDER BY p.id FOR UPDATE`;
      await tx.user.delete({ where: { id: userId } });
      for (const p of affected) {
        const updated = await tx.poll.update({
          where: { id: p.id },
          data: { revision: { increment: 1 } },
        });
        await tx.$executeRaw`SELECT pg_notify('quack_poll_changed', ${JSON.stringify({ quackId: p.quackId, revision: updated.revision })})`;
      }
    });
  }

  async createQuack(data: {
    text: string;
    mood?: QuackMood | null;
    userId: string;
    parentId?: string;
    poll?: CreatePoll;
  }): Promise<Quack> {
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "user" WHERE id = ${data.userId} FOR UPDATE`;
      if (!users.length)
        throw new ForbiddenException('Account no longer exists');
      const parent = data.parentId
        ? await tx.quack.findUnique({ where: { id: data.parentId } })
        : null;
      if (data.parentId && !parent)
        throw new NotFoundException('Reply target not found');
      const q = await tx.quack.create({
        data: {
          text: data.text,
          mood: data.mood,
          userId: data.userId,
          ...(parent
            ? { parentId: parent.id, rootId: parent.rootId ?? parent.id }
            : {}),
          ...(data.poll
            ? {
                poll: {
                  create: {
                    question: data.poll.question,
                    options: {
                      create: data.poll.options.map((text, position) => ({
                        text,
                        position,
                      })),
                    },
                  },
                },
              }
            : {}),
        },
        include: includeQuack(data.userId),
      });
      if (q.poll)
        await tx.pollUsage.create({
          data: { pollId: q.poll.id, createdAt: q.poll.createdAt },
        });
      return mapQuack(q);
    });
  }
}
