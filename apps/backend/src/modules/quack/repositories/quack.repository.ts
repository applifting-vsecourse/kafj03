import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { CreatePoll } from '@/modules/quack/domain/poll';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoadedPoll, mapPollResult, pollInclude } from './poll-result';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser; poll?: LoadedPoll | null },
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
  poll: quack.poll ? mapPollResult(quack.poll) : null,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
});

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
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

  async getQuacks(userId?: string): Promise<Quack[]> {
    // Prisma may load relations with separate queries. A shared snapshot keeps
    // revision, counts and the viewer's choice consistent during concurrent votes.
    return this.prisma.$transaction(
      async (tx) => {
        const quacks = await tx.quack.findMany({
          include: { user: true, poll: { include: pollInclude(userId) } },
          orderBy: { createdAt: 'desc' },
        });
        return quacks.map(mapPrismaQuackToDomain);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async getQuack(id: string, userId: string): Promise<Quack> {
    return this.prisma.$transaction(
      async (tx) => {
        const quack = await tx.quack.findUnique({
          where: { id },
          include: { user: true, poll: { include: pollInclude(userId) } },
        });
        if (!quack) throw new NotFoundException('Post not found');
        return mapPrismaQuackToDomain(quack);
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async deleteQuack(id: string, userId: string): Promise<void> {
    // Ownership is part of the DELETE, so it cannot change between checking and deleting.
    const deleted = await this.prisma.quack.deleteMany({
      where: { id, userId },
    });
    if (deleted.count) return;
    const exists = await this.prisma.quack.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Post not found');
    throw new ForbiddenException('You can only delete your own posts');
  }

  async createQuack(createQuackData: {
    text: string;
    mood?: QuackMood | null;
    userId: string;
    poll?: CreatePoll;
  }): Promise<Quack> {
    const quack = await this.prisma.$transaction(async (tx) => {
      const created = await tx.quack.create({
        data: {
          text: createQuackData.text,
          mood: createQuackData.mood,
          user: { connect: { id: createQuackData.userId } },
          ...(createQuackData.poll
            ? {
                poll: {
                  create: {
                    question: createQuackData.poll.question,
                    options: {
                      create: createQuackData.poll.options.map(
                        (text, position) => ({ text, position }),
                      ),
                    },
                  },
                },
              }
            : {}),
        },
        include: {
          user: true,
          poll: { include: pollInclude(createQuackData.userId) },
        },
      });
      if (created.poll) {
        await tx.pollUsage.create({
          data: { pollId: created.poll.id, createdAt: created.poll.createdAt },
        });
      }
      return created;
    });
    return mapPrismaQuackToDomain(quack);
  }
}
