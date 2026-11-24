import { AppModule } from '@/app.module';
import { configureHttp } from '@/configure-http';
import { Config } from '@/shared/config/config.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('GET /api/quacks', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('EmailService')
      .useValue({ sendEmail: jest.fn() })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 401 to a visitor', async () => {
    await request(app.getHttpServer()).get('/api/quacks').expect(401);
  });

  it('returns 200 and the persisted quack to a signed-in user', async () => {
    const server = app.getHttpServer();
    const origin = app.get(Config).frontendUrl;
    const credentials = {
      email: 'integration@example.invalid',
      password: 'integration-test-password',
    };
    await request(server)
      .post('/api/auth/sign-up/email')
      .set('Origin', origin)
      .send({ ...credentials, name: 'Integration test' })
      .expect(200);

    const user = request.agent(server);
    await user
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send(credentials)
      .expect(200);

    const text = 'Quack from the integration test';
    const created = await user.post('/api/quacks').send({ text }).expect(201);
    const feed = await user.get('/api/quacks').expect(200);
    expect(feed.body).toEqual([
      expect.objectContaining({ id: created.body.id, text }),
    ]);
  });
});
