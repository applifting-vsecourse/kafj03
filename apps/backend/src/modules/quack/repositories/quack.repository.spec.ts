import { PrismaService } from '@/core/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { mockDeep } from 'jest-mock-extended';
import { QuackRepository } from './quack.repository';

describe('QuackRepository deletion ownership', () => {
  it('deletes only with the authenticated author in the database predicate', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.deleteMany.mockResolvedValue({ count: 1 });
    await new QuackRepository(prisma).deleteQuack('q1', 'author');
    expect(prisma.quack.deleteMany).toHaveBeenCalledWith({
      where: { id: 'q1', userId: 'author' },
    });
    expect(prisma.quack.findUnique).not.toHaveBeenCalled();
  });

  it('rejects deleting an existing post belonging to someone else', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.deleteMany.mockResolvedValue({ count: 0 });
    prisma.quack.findUnique.mockResolvedValue({ id: 'q1' } as never);
    await expect(
      new QuackRepository(prisma).deleteQuack('q1', 'other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.quack.deleteMany).toHaveBeenCalledWith({
      where: { id: 'q1', userId: 'other' },
    });
  });

  it('reports a missing post', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.quack.deleteMany.mockResolvedValue({ count: 0 });
    prisma.quack.findUnique.mockResolvedValue(null);
    await expect(
      new QuackRepository(prisma).deleteQuack('missing', 'author'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
