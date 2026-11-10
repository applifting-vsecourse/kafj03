import { PrismaService } from '@/core/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup() {
  const prisma = mockDeep<PrismaService>();
  prisma.$transaction.mockImplementation(async (callback: unknown) =>
    (callback as (tx: PrismaService) => Promise<void>)(prisma),
  );
  return { prisma, repository: new QuackRepository(prisma) };
}
describe('QuackRepository erasure', () => {
  it('atomically removes the poll and clears content instead of deleting the quack', async () => {
    const { prisma, repository } = setup();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ role: 'admin' }])
      .mockResolvedValueOnce([{ id: 'q1', userId: 'other', deletedAt: null }]);
    await repository.deleteQuack('q1', 'admin');
    expect(prisma.poll.deleteMany).toHaveBeenCalledWith({
      where: { quackId: 'q1' },
    });
    expect(prisma.quack.update).toHaveBeenCalledWith({
      where: { id: 'q1' },
      data: {
        text: null,
        mood: null,
        userId: null,
        deletedAt: expect.any(Date),
      },
    });
    expect(prisma.quack.deleteMany).not.toHaveBeenCalled();
  });
  it('checks the persisted role again while holding the transaction locks', async () => {
    const { prisma, repository } = setup();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ role: 'user' }])
      .mockResolvedValueOnce([{ id: 'q1', userId: 'other', deletedAt: null }]);
    await expect(
      repository.deleteQuack('q1', 'revoked-admin'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.poll.deleteMany).not.toHaveBeenCalled();
  });
  it('does not modify an already erased row', async () => {
    const { prisma, repository } = setup();
    prisma.$queryRaw.mockResolvedValue([{ id: 'q1', deletedAt: new Date() }]);
    await repository.deleteQuack('q1');
    expect(prisma.quack.update).not.toHaveBeenCalled();
  });
  it('reports a missing post', async () => {
    const { prisma, repository } = setup();
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(repository.deleteQuack('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
