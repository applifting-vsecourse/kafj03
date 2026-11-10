import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/core/prisma/prisma.service';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuacksController } from './quacks.controller';

jest.mock('@/shared/auth/guards/authenticated-user.guard', () => ({
  AuthenticatedUserGuard: class {},
}));
const databaseDescribe =
  process.env.POLL_DB_TESTS === '1' ? describe : describe.skip;
// Isolated HTTP server and session adapter; the production controller, DTO pipes,
// service, repository and PostgreSQL constraints run unchanged. The Playwright
// suite additionally exercises real BetterAuth sessions against the running app.
databaseDescribe('Quacks HTTP authorization and replies', () => {
  let db: PrismaService;
  let repository: QuackRepository;
  let app: INestApplication;
  let url: string;
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const sessions = new Map(
    ids.map((id, i) => [
      `session=${id}`,
      new Identity(
        id,
        `${id}@example.invalid`,
        'HTTP test',
        i === 2 ? 'admin' : 'user',
      ),
    ]),
  );
  beforeAll(async () => {
    db = new PrismaService();
    await db.$connect();
    repository = new QuackRepository(db);
    await db.user.createMany({
      data: ids.map((id, i) => ({
        id,
        name: 'HTTP test',
        email: `${id}@example.invalid`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: i === 2 ? 'admin' : 'user',
      })),
    });
    const service = new QuacksService(repository);
    if (process.env.AUTHORIZATION_MUTANT === '1') {
      // Mutation probe: bypass both service and transactional permission checks.
      jest
        .spyOn(service, 'deleteQuack')
        .mockImplementation((id) => repository.deleteQuack(id));
    }
    const module = await Test.createTestingModule({
      controllers: [QuacksController],
      providers: [{ provide: QuacksService, useValue: service }],
    })
      .overrideGuard(AuthenticatedUserGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            headers: { cookie?: string };
            session?: { user: Identity };
          }>();
          const user = sessions.get(req.headers.cookie ?? '');
          if (!user) throw new UnauthorizedException();
          req.session = { user };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
    if (db) {
      for (const id of ids)
        if (await db.user.findUnique({ where: { id } }))
          await repository.deleteAccount(id);
      await db.$disconnect();
    }
  });
  it('enforces 401/403, preserves foreign replies, and reads the current role', async () => {
    const call = (
      path: string,
      index?: number,
      method = 'GET',
      data?: object,
    ): Promise<Response> =>
      fetch(`${url}/quacks${path}`, {
        method,
        headers: {
          ...(index === undefined ? {} : { cookie: `session=${ids[index]}` }),
          'content-type': 'application/json',
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      });
    const rootResponse = await call('', 0, 'POST', { text: 'Private root' });
    expect(rootResponse.status).toBe(201);
    const root = (await rootResponse.json()) as { id: string };
    const replyResponse = await call('', 1, 'POST', {
      text: 'Independent reply',
      parentId: root.id,
    });
    expect(replyResponse.status).toBe(201);
    const reply = (await replyResponse.json()) as {
      id: string;
      rootId: string;
    };
    expect(reply.rootId).toBe(root.id);
    expect((await call(`/${root.id}`, undefined, 'DELETE')).status).toBe(401);
    expect((await call(`/${root.id}`, 1, 'DELETE')).status).toBe(403);
    expect((await call(`/${reply.id}`, 0, 'DELETE')).status).toBe(403);
    expect(
      (
        await call('', 1, 'POST', {
          text: 'Forged',
          parentId: root.id,
          rootId: 'forged',
        })
      ).status,
    ).toBe(400);
    await db.user.update({ where: { id: ids[2] }, data: { role: 'user' } });
    expect((await call(`/${root.id}`, 2, 'DELETE')).status).toBe(403);
    await db.user.update({ where: { id: ids[2] }, data: { role: 'admin' } });
    expect((await call(`/${root.id}`, 2, 'DELETE')).status).toBe(204);
    expect(await (await call(`/${root.id}`, 1)).json()).toMatchObject({
      text: null,
      userId: null,
      user: null,
      replyCount: 1,
    });
    expect(await (await call(`/${reply.id}`, 1)).json()).toMatchObject({
      text: 'Independent reply',
      parent: { text: null, user: null },
    });
    expect((await call(`/${root.id}`, 1, 'DELETE')).status).toBe(204);
    expect(
      (await call('', 1, 'POST', { text: 'Continue', parentId: root.id }))
        .status,
    ).toBe(201);
    expect(await (await call(`/${root.id}/replies`, 1)).json()).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: reply.id }),
      ]),
    });
  });
});
