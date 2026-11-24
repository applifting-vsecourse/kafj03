import { LikeKey, planLikeChange } from './quack-likes';

const quack = { id: 'quack-1', userId: 'author' };
const otherQuack = { id: 'quack-2', userId: 'author' };
const likeA = { quackId: quack.id, userId: 'a' };
const likeB = { quackId: quack.id, userId: 'b' };

function requestLike(
  rows: readonly LikeKey[],
  target: typeof quack,
  userId: string,
  wantLiked: boolean,
): Promise<LikeKey[]> {
  return Promise.resolve().then(() => {
    const matches = (row: LikeKey): boolean =>
      row.quackId === target.id && row.userId === userId;
    const change = planLikeChange(
      target,
      userId,
      rows.some(matches),
      wantLiked,
    );

    // Apply the planned write to fixture rows without enforcing uniqueness here.
    switch (change.operation) {
      case 'insert':
        return [...rows, change.like];
      case 'delete':
        return rows.filter(
          (row) =>
            row.quackId !== change.like.quackId ||
            row.userId !== change.like.userId,
        );
      case 'none':
        return [...rows];
    }
  });
}

describe('Quack like rules', () => {
  it('U1 first like increases the count from zero to one', async () => {
    await expect(requestLike([], quack, 'a', true)).resolves.toEqual([likeA]);
  });

  it('U2 allows one like per user and quack', async () => {
    await expect(requestLike([likeA], quack, 'a', true)).resolves.toEqual([
      likeA,
    ]);
    await expect(requestLike([likeA], otherQuack, 'a', true)).resolves.toEqual([
      likeA,
      { quackId: otherQuack.id, userId: 'a' },
    ]);
  });

  it('U3 each user contributes their own like', async () => {
    await expect(requestLike([likeA], quack, 'b', true)).resolves.toEqual([
      likeA,
      likeB,
    ]);
  });

  it('U4 allows authors to like their own quacks', async () => {
    await expect(requestLike([], quack, quack.userId, true)).resolves.toEqual([
      { quackId: quack.id, userId: quack.userId },
    ]);
  });

  it('U5 removing a like preserves other users’ likes', async () => {
    await expect(
      requestLike([likeA, likeB], quack, 'a', false),
    ).resolves.toEqual([likeB]);
  });

  it.each([
    { context: 'an empty quack', rows: [] },
    { context: 'a quack with someone else’s like', rows: [likeB] },
  ])(
    'U6 removing an absent like leaves $context unchanged',
    async ({ rows }) => {
      await expect(requestLike(rows, quack, 'a', false)).resolves.toEqual(rows);
    },
  );
});
