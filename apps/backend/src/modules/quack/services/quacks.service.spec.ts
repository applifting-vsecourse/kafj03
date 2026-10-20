// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { ForbiddenException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  text: 'quack quack',
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

describe('QuacksService', () => {
  it.each(['happy', 'sad', 'angry', 'silly'] as const)(
    'persists %s mood',
    async (mood) => {
      const repository = mock<QuackRepository>();
      repository.createQuack.mockResolvedValue(aQuack({ mood }));
      const service = new QuacksService(repository);
      const created = await service.createQuack({ id: 'u1' } as Identity, {
        text: 'hello',
        mood,
      });
      expect(repository.createQuack).toHaveBeenCalledWith({
        text: 'hello',
        mood,
        userId: 'u1',
      });
      expect(created.mood).toBe(mood);
    },
  );

  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks()).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(service.createQuack(user, { text: 'hello' })).resolves.toEqual(
      created,
    );
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      userId: 'u1',
      mood: undefined,
    });
  });
});

describe('QuacksService deletion authorization', () => {
  it.each([
    ['owner', 'u1', 'user', 'user', true],
    ['admin', 'u2', 'admin', 'admin', true],
    ['other user', 'u2', 'user', 'user', false],
    ['revoked admin', 'u2', 'admin', 'user', false],
    ['new admin with old session', 'u2', 'user', 'admin', true],
  ])('%s', async (_, id, sessionRole, persistedRole, allowed) => {
    const repository = mock<QuackRepository>();
    repository.getQuack.mockResolvedValue(aQuack());
    repository.getUserRole.mockResolvedValue(persistedRole as string);
    const service = new QuacksService(repository);
    const result = service.deleteQuack(
      'q1',
      new Identity(
        id as string,
        'duck@example.com',
        'Duck',
        sessionRole as string,
      ),
    );
    if (allowed) {
      await expect(result).resolves.toBeUndefined();
      expect(repository.deleteQuack).toHaveBeenCalledWith(
        'q1',
        persistedRole === 'admin' ? undefined : id,
      );
    } else {
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.deleteQuack).not.toHaveBeenCalled();
    }
    expect(repository.getUserRole).toHaveBeenCalledWith(id);
  });
});
