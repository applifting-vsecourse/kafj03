export type CreatePoll = { question: string; options: string[] };

export type PollResult = {
  id: string;
  question: string;
  revision: number;
  totalVotes: number;
  myOptionId: string | null;
  options: {
    id: string;
    text: string;
    position: number;
    votes: number;
    percentage: number;
  }[];
};
