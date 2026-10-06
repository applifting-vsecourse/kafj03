import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
  userId: quack.userId,
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

  async getQuacks(): Promise<Quack[]> {
    const quacks = await this.prisma.quack.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood?: QuackMood | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: { user: true },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
