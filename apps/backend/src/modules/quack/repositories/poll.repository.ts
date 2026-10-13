import { PrismaService } from '@/core/prisma/prisma.service';
import { PollResult } from '@/modules/quack/domain/poll';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mapPollResult, pollInclude } from './poll-result';

@Injectable()
export class PollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async vote(
    quackId: string,
    userId: string,
    optionId: string,
  ): Promise<PollResult> {
    return this.prisma.$transaction(async (tx) => {
      // Every vote writer locks the poll first. ReadCommitted sees previously
      // committed votes, including writes from another device.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "poll" WHERE "quackId" = ${quackId} FOR UPDATE
      `;
      const pollId = locked[0]?.id;
      if (!pollId) throw new NotFoundException('Poll not found');
      const option = await tx.pollOption.findUnique({
        where: { pollId_id: { pollId, id: optionId } },
      });
      if (!option)
        throw new BadRequestException('Option does not belong to this poll');
      const previous = await tx.pollVote.findUnique({
        where: { pollId_userId: { pollId, userId } },
      });
      if (previous?.optionId !== optionId) {
        await tx.pollVote.upsert({
          where: { pollId_userId: { pollId, userId } },
          create: { pollId, userId, optionId },
          update: { optionId },
        });
        await tx.poll.update({
          where: { id: pollId },
          data: { revision: { increment: 1 } },
        });
        await tx.$executeRaw`
          UPDATE "poll_usage" SET "firstVotedAt" = CURRENT_TIMESTAMP
          WHERE "pollId" = ${pollId} AND "firstVotedAt" IS NULL
        `;
        await tx.$executeRaw`
          INSERT INTO "poll_voter_usage" ("userId", "firstVotedAt")
          VALUES (${userId}, CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO NOTHING
        `;
      }
      const poll = await tx.poll.findUniqueOrThrow({
        where: { id: pollId },
        include: pollInclude(userId),
      });
      if (previous?.optionId !== optionId) {
        // PostgreSQL delivers NOTIFY only after this transaction commits.
        const payload = JSON.stringify({ quackId, revision: poll.revision });
        await tx.$executeRaw`SELECT pg_notify('quack_poll_changed', ${payload})`;
      }
      return mapPollResult(poll);
    });
  }
}
