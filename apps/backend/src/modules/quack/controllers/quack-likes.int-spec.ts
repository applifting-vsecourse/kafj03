import { AppModule } from '@/app.module';
import { configureHttp } from '@/configure-http';
import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { LikeKey } from '@/modules/quack/domain/quack-likes';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Config } from '@/shared/config/config.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

type Client = Pick<request.Agent, 'get' | 'post' | 'put' | 'delete'>;
type QuackView = { id: string; likeCount?: number; likedByMe?: boolean };

describe('Quack likes over HTTP and PostgreSQL', () => {
  let app: INestApplication;
  let database: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('EmailService')
      .useValue({ sendEmail: jest.fn() })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureHttp(app);
    await app.listen(0, '127.0.0.1');
    database = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function signIn(name: string): Promise<{ id: string; client: Client }> {
    const server = app.getHttpServer();
    const origin = app.get(Config).frontendUrl;
    const credentials = {
      email: `${name}@example.invalid`,
      password: 'integration-test-password',
    };
    const signup = await request(server)
      .post('/api/auth/sign-up/email')
      .set('Origin', origin)
      .send({ ...credentials, name })
      .expect(200);
    const client = request.agent(server);
    await client
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send(credentials)
      .expect(200);
    return { id: (signup.body as { user: { id: string } }).user.id, client };
  }

  async function createQuack(
    client: Client,
    parentId?: string,
  ): Promise<string> {
    const created = await client
      .post('/api/quacks')
      .send({ text: 'Quack for the like integration tests', parentId })
      .expect(201);
    return (created.body as QuackView).id;
  }

  const path = (id: string): string => `/api/quacks/${id}`;
  const likePath = (id: string): string => `${path(id)}/like`;

  async function readQuack(client: Client, id: string): Promise<QuackView> {
    const detail = await client.get(path(id)).expect(200);
    return detail.body as QuackView;
  }

  async function readFeedAndDetail(
    client: Client,
    id: string,
  ): Promise<(QuackView | undefined)[]> {
    const feed = await client.get('/api/quacks').expect(200);
    const item = (feed.body as QuackView[]).find((quack) => quack.id === id);
    return [item && likeState(item), likeState(await readQuack(client, id))];
  }

  const likeState = ({ id, likeCount, likedByMe }: QuackView): QuackView => ({
    id,
    likeCount,
    likedByMe,
  });
  const view = (
    id: string,
    likeCount: number,
    likedByMe: boolean,
  ): QuackView => ({
    id,
    likeCount,
    likedByMe,
  });

  async function storedLikes(ids: string[]): Promise<LikeKey[] | null> {
    // Keep the missing relation observable in assertions during the test-first phase.
    const [table] = await database.$queryRaw<{ exists: boolean }[]>`
      SELECT to_regclass('public.quack_like') IS NOT NULL AS exists
    `;
    if (!table.exists) return null;

    return database.$queryRaw<LikeKey[]>`
      SELECT "quackId", "userId" FROM quack_like
      WHERE "quackId" IN (${Prisma.join(ids)})
      ORDER BY "quackId", "userId"
    `;
  }

  function expectRows(rows: LikeKey[] | null, expected: LikeKey[]): void {
    expect(rows).toHaveLength(expected.length);
    expect(rows).toEqual(expect.arrayContaining(expected));
  }

  it('I1 shows a new like and its removal in the feed and detail', async () => {
    const { client } = await signIn('reader');
    const id = await createQuack(client);
    const initial = await readFeedAndDetail(client, id);
    const added = await client.put(likePath(id));
    const afterAdd = await readFeedAndDetail(client, id);
    const removed = await client.delete(likePath(id));
    const afterRemove = await readFeedAndDetail(client, id);

    expect({
      initial,
      added: added.ok,
      afterAdd,
      removed: removed.ok,
      afterRemove,
    }).toEqual({
      initial: [view(id, 0, false), view(id, 0, false)],
      added: true,
      afterAdd: [view(id, 1, true), view(id, 1, true)],
      removed: true,
      afterRemove: [view(id, 0, false), view(id, 0, false)],
    });
  });

  it('I2 treats repeated requests as successful and preserves another like', async () => {
    const a = await signIn('reader-a');
    const b = await signIn('reader-b');
    const id = await createQuack(b.client);
    const seeded = await b.client.put(likePath(id));
    const outcomes: { ok: boolean; quack: QuackView }[] = [];

    for (const method of ['put', 'put', 'delete', 'delete'] as const) {
      const response = await a.client[method](likePath(id));
      outcomes.push({
        ok: response.ok,
        quack: likeState(await readQuack(a.client, id)),
      });
    }
    const otherReader = likeState(await readQuack(b.client, id));
    const rows = await storedLikes([id]);

    expect({ seeded: seeded.ok, outcomes, otherReader }).toEqual({
      seeded: true,
      outcomes: [
        { ok: true, quack: view(id, 2, true) },
        { ok: true, quack: view(id, 2, true) },
        { ok: true, quack: view(id, 1, false) },
        { ok: true, quack: view(id, 1, false) },
      ],
      otherReader: view(id, 1, true),
    });
    expectRows(rows, [{ quackId: id, userId: b.id }]);
  });

  it('I3 rejects signed-out writes with 401 and preserves stored likes', async () => {
    const author = await signIn('author');
    const id = await createQuack(author.client);
    const seeded = await author.client.put(likePath(id));
    const before = await storedLikes([id]);
    const visitor = request(app.getHttpServer());
    const added = await visitor.put(likePath(id));
    const removed = await visitor.delete(likePath(id));
    const after = await storedLikes([id]);

    expect([added.status, removed.status]).toEqual([401, 401]);
    const expected = [{ quackId: id, userId: author.id }];
    expect({ seedAccepted: seeded.ok, before, after }).toEqual({
      seedAccepted: true,
      before: expected,
      after: expected,
    });
  });

  it('I4 returns the same count and a viewer-specific like state', async () => {
    const a = await signIn('reader-a');
    const b = await signIn('reader-b');
    const id = await createQuack(b.client);
    const seeded = await a.client.put(likePath(id));
    const [viewsA, viewsB] = await Promise.all([
      readFeedAndDetail(a.client, id),
      readFeedAndDetail(b.client, id),
    ]);

    expect({ seeded: seeded.ok, viewsA, viewsB }).toEqual({
      seeded: true,
      viewsA: [view(id, 1, true), view(id, 1, true)],
      viewsB: [view(id, 1, false), view(id, 1, false)],
    });
  });

  it('I5 returns 404 for both operations on missing and erased quacks', async () => {
    const { client } = await signIn('author');
    const erased = await createQuack(client);
    await client.delete(path(erased)).expect(204);
    const targetIds = ['missing-quack', erased];
    const before = await storedLikes(targetIds);
    const statuses: number[] = [];

    for (const id of targetIds) {
      statuses.push((await client.put(likePath(id))).status);
      statuses.push((await client.delete(likePath(id))).status);
    }
    const after = await storedLikes(targetIds);

    expect(statuses).toEqual([404, 404, 404, 404]);
    expectRows(before, []);
    expectRows(after, []);
  });

  it('I6 erases the quack’s likes and preserves likes on its surviving reply', async () => {
    const a = await signIn('author');
    const b = await signIn('reply-author');
    const id = await createQuack(a.client);
    const replyId = await createQuack(b.client, id);
    const seeded = [
      await a.client.put(likePath(id)),
      await b.client.put(likePath(id)),
      await a.client.put(likePath(replyId)),
    ];
    const before = await storedLikes([id, replyId]);

    await a.client.delete(path(id)).expect(204);
    const [root, replies] = await Promise.all([
      readQuack(a.client, id),
      a.client.get(`${path(id)}/replies`).expect(200),
    ]);
    const after = await storedLikes([id, replyId]);

    expect({
      seedAccepted: seeded.map((item) => item.ok),
      root,
      replies: (replies.body as { items: QuackView[] }).items.map(likeState),
      after,
    }).toEqual({
      seedAccepted: [true, true, true],
      root: expect.objectContaining({
        id,
        text: null,
        userId: null,
        deletedAt: expect.any(String),
      }),
      replies: [view(replyId, 1, true)],
      after: [{ quackId: replyId, userId: a.id }],
    });
    expectRows(before, [
      { quackId: id, userId: a.id },
      { quackId: id, userId: b.id },
      { quackId: replyId, userId: a.id },
    ]);
  });

  it('I7 erases an account’s likes and keeps other users’ likes', async () => {
    const a = await signIn('deleted-account');
    const b = await signIn('author');
    const c = await signIn('other-author');
    const first = await createQuack(b.client);
    const second = await createQuack(c.client);
    const seeded = [
      await a.client.put(likePath(first)),
      await a.client.put(likePath(second)),
      await b.client.put(likePath(first)),
    ];
    const before = [
      await readQuack(b.client, first),
      await readQuack(b.client, second),
    ].map(likeState);

    // Account erasure is an existing trusted backend operation.
    await app.get(QuackRepository).deleteAccount(a.id);
    const after = [
      await readQuack(b.client, first),
      await readQuack(b.client, second),
    ].map(likeState);
    const rows = await storedLikes([first, second]);

    expect({
      seedAccepted: seeded.map((item) => item.ok),
      before,
      after,
      rows,
    }).toEqual({
      seedAccepted: [true, true, true],
      before: [view(first, 2, true), view(second, 1, false)],
      after: [view(first, 1, true), view(second, 0, false)],
      rows: [{ quackId: first, userId: b.id }],
    });
  });
});
