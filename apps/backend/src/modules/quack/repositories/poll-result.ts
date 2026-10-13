import { PollResult } from '@/modules/quack/domain/poll';

// Only the current viewer's vote is loaded; other voters' identities never
// leave the database query. Counts include all votes.
export type LoadedPoll = {
  id: string;
  question: string;
  revision: number;
  options: {
    id: string;
    text: string;
    position: number;
    _count: { votes: number };
    votes: { userId: string }[];
  }[];
};

export function mapPollResult(poll: LoadedPoll): PollResult {
  const totalVotes = poll.options.reduce(
    (total, option) => total + option._count.votes,
    0,
  );
  return {
    id: poll.id,
    question: poll.question,
    revision: poll.revision,
    totalVotes,
    myOptionId:
      poll.options.find((option) => option.votes.length > 0)?.id ?? null,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      position: option.position,
      votes: option._count.votes,
      percentage: totalVotes
        ? Math.round((option._count.votes * 100) / totalVotes)
        : 0,
    })),
  };
}

type PollInclude = {
  options: {
    orderBy: { position: 'asc' };
    include: {
      _count: { select: { votes: true } };
      votes: { where: { userId: string }; select: { userId: true } };
    };
  };
};

export const pollInclude = (userId?: string): PollInclude => ({
  options: {
    orderBy: { position: 'asc' as const },
    include: {
      _count: { select: { votes: true } },
      votes: { where: { userId: userId ?? '' }, select: { userId: true } },
    },
  },
});
