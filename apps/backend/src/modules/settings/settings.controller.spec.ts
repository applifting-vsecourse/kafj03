import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { Identity } from '@/shared/auth/domain/identity';
import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { mockDeep } from 'jest-mock-extended';
import { SettingsController, UpdateSettingsDto } from './settings.controller';

jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));

const values = {
  username: 'alice.new',
  name: 'Alice',
  bio: '',
  defaultMood: null,
};
describe('SettingsController', () => {
  it('updates only the authenticated user and preserves username case', async () => {
    const prisma = mockDeep<PrismaService>();
    const controller = new SettingsController(prisma);
    await controller.update(new Identity('u1', 'a@b.cz', 'Alice', 'user'), {
      ...values,
      username: 'Alice.New',
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: {
          ...values,
          username: 'Alice.New',
          displayUsername: 'Alice.New',
        },
      }),
    );
  });
  it('turns a database uniqueness race into a conflict', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '7',
      }),
    );
    await expect(
      new SettingsController(prisma).update(
        new Identity('u1', 'a@b.cz', 'Alice', 'user'),
        values,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each([
    { username: 'ab' },
    { username: 'a'.repeat(31) },
    { username: 'bad name' },
    { name: '  ' },
    { bio: 'a'.repeat(161) },
    { defaultMood: 'unknown' },
  ])('rejects invalid settings %o', async (invalid) => {
    expect(
      (
        await validate(
          plainToInstance(UpdateSettingsDto, { ...values, ...invalid }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('accepts boundary values and an empty bio and mood', async () => {
    expect(
      await validate(
        plainToInstance(UpdateSettingsDto, {
          ...values,
          username: 'a_1',
          name: ' Alice ',
        }),
      ),
    ).toEqual([]);
    expect(
      await validate(
        plainToInstance(UpdateSettingsDto, {
          ...values,
          username: 'a'.repeat(30),
          bio: 'b'.repeat(160),
          defaultMood: 'silly',
        }),
      ),
    ).toEqual([]);
  });
});
