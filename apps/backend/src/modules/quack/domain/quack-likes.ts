import { Quack } from './quack';

export type LikeKey = { quackId: string; userId: string };

export type LikeChange =
  { operation: 'insert' | 'delete'; like: LikeKey } | { operation: 'none' };

export function planLikeChange(
  quack: Pick<Quack, 'id' | 'userId'>,
  userId: string,
  alreadyLiked: boolean,
  wantLiked: boolean,
): LikeChange;
export function planLikeChange(): LikeChange {
  throw new Error('not implemented');
}
