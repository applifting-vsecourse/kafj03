import { PrismaService } from '@/core/prisma/prisma.service';

export function parseLaunchTime(value: string | undefined): Date {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) {
    throw new Error(
      'Supply the actual launch time in UTC, e.g. 2026-10-13T10:00:00Z',
    );
  }
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 19) !== value.slice(0, 19)
  ) {
    throw new Error('Invalid launch timestamp');
  }
  return date;
}

export type PollReport = {
  periodStart: string;
  periodEndExclusive: string;
  generatedAt: string;
  isComplete: boolean;
  createdPolls: number;
  pollsWithVotes: number;
  pollsWithVotesShare: number;
  uniqueVoters: number;
};

export async function generatePollReport(
  prisma: PrismaService,
  start: Date,
  now = new Date(),
): Promise<PollReport> {
  if (!Number.isFinite(start.getTime()) || start > now)
    throw new Error('Launch time must be a valid timestamp in the past');
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
  // A half-open interval includes the launch instant and excludes day 31.
  const range = { gte: start, lt: end };
  const counts = await prisma.$transaction(
    async (tx) => {
      const createdPolls = await tx.pollUsage.count({
        where: { createdAt: range },
      });
      const pollsWithVotes = await tx.pollUsage.count({
        where: { createdAt: range, firstVotedAt: range },
      });
      const uniqueVoters = await tx.pollVoterUsage.count({
        where: { firstVotedAt: range },
      });
      return { createdPolls, pollsWithVotes, uniqueVoters };
    },
    { isolationLevel: 'RepeatableRead' },
  );
  return {
    periodStart: start.toISOString(),
    periodEndExclusive: end.toISOString(),
    generatedAt: now.toISOString(),
    isComplete: now >= end,
    ...counts,
    pollsWithVotesShare: counts.createdPolls
      ? counts.pollsWithVotes / counts.createdPolls
      : 0,
  };
}
