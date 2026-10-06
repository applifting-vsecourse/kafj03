import { Quack } from '@/modules/quack/domain/quack';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { QuacksController } from './quacks.controller';

jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const quack: Quack = {
  id: 'q1',
  text: 'hello',
  userId: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 'u1', name: 'Duck', username: 'duck' },
};

describe('QuacksController', () => {
  it.each(['happy', 'sad', 'angry', 'silly'] as const)(
    'passes %s mood through creation and feed responses',
    async (mood) => {
      const service = mock<QuacksService>();
      service.createQuack.mockResolvedValue({ ...quack, mood });
      service.getQuacks.mockResolvedValue([{ ...quack, mood }]);
      const controller = new QuacksController(service);
      const user = { id: 'u1' } as Identity;

      expect(
        await controller.create(user, { text: 'hello', mood }),
      ).toMatchObject({ mood });
      expect(service.createQuack).toHaveBeenCalledWith(user, {
        text: 'hello',
        mood,
      });
      expect(await controller.list()).toEqual([
        expect.objectContaining({ mood }),
      ]);
    },
  );

  it('allows creating a post without mood', async () => {
    const service = mock<QuacksService>();
    service.createQuack.mockResolvedValue(quack);
    const controller = new QuacksController(service);
    expect(
      await controller.create({ id: 'u1' } as Identity, { text: 'hello' }),
    ).toMatchObject({ mood: null });
  });
});
