import { PollResult } from './poll';

export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type QuackMood = (typeof QUACK_MOODS)[number];

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export type Quack = {
  id: string;
  text: string | null;
  mood?: QuackMood | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor | null;
  poll?: PollResult | null;
  deletedAt?: Date | null;
  parentId?: string | null;
  rootId?: string | null;
  replyCount?: number;
  parent?: {
    id: string;
    text: string | null;
    deletedAt: Date | null;
    user: QuackAuthor | null;
  } | null;
};
