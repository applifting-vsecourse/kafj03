import { Quack } from './quack';

export type LikeKey = { quackId: string; userId: string };

export type LikeChange =
  { operation: 'insert' | 'delete'; like: LikeKey } | { operation: 'none' };

export function planLikeChange(
  quack: Pick<Quack, 'id' | 'userId'>,
  userId: string,
  alreadyLiked: boolean,
  wantLiked: boolean,
): LikeChange {
  if (alreadyLiked === wantLiked) return { operation: 'none' };
  return {
    operation: wantLiked ? 'insert' : 'delete',
    like: { quackId: quack.id, userId },
  };
}
