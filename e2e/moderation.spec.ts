import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';

const backendRequire = createRequire(path.resolve('apps/backend/package.json'));
backendRequire('dotenv').config({ path: 'apps/backend/.env', quiet: true });
const { Pool } = backendRequire('pg');
const backendURL = process.env.E2E_BACKEND_URL ?? 'http://localhost:4050';

test('admin deletes another author’s quack; a regular user gets 403', async ({
  page,
  playwright,
}) => {
  const database = new Pool({ connectionString: process.env.DATABASE_URL });
  const clients = [];
  const userIds: string[] = [];
  const password = `E2e-${randomUUID()}`;
  const marker = `Moderation E2E ${randomUUID()}`;
  const observer = await page.context().newPage();

  try {
    // Real BetterAuth sessions, separate cookie jars, and disposable accounts.
    for (const role of ['author', 'regular', 'admin']) {
      const client = await playwright.request.newContext({
        baseURL: backendURL,
        extraHTTPHeaders: {
          Origin: process.env.E2E_FRONTEND_URL ?? 'http://localhost:3050',
        },
      });
      clients.push(client);
      const email = `e2e-${role}-${randomUUID()}@example.invalid`;
      const signup = await client.post('/api/auth/sign-up/email', {
        data: { email, password, name: `E2E ${role}` },
      });
      expect(signup.ok()).toBeTruthy();
      const { user } = await signup.json();
      userIds.push(user.id);

      if (role === 'admin') {
        // Provision the role exactly as in production: a database change.
        await database.query('UPDATE "user" SET role = $1 WHERE id = $2', [
          'admin',
          user.id,
        ]);
        await page.goto('/login');
        await page.getByLabel('Email', { exact: true }).fill(email);
        await page.getByLabel('Password', { exact: true }).fill(password);
        const signedIn = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/auth/sign-in/email') &&
            response.request().method() === 'POST',
        );
        await page
          .getByRole('button', { name: 'Sign in', exact: true })
          .click();
        expect((await signedIn).status()).toBe(200);
        // Enter with a fresh page after login so the route loads the new session.
        await page.goto('/quacks');
        await expect(page).toHaveURL(/\/quacks$/);
      } else {
        const signin = await client.post('/api/auth/sign-in/email', {
          data: { email, password },
        });
        expect(signin.ok()).toBeTruthy();
      }
    }

    const created = await clients[0].post('/api/quacks', {
      data: { text: marker },
    });
    expect(created.status()).toBe(201);
    const quack = await created.json();
    expect(quack.userId).toBe(userIds[0]);

    const anonymous = await playwright.request.newContext({
      baseURL: backendURL,
    });
    clients.push(anonymous);
    expect((await anonymous.delete(`/api/quacks/${quack.id}`)).status()).toBe(
      401,
    );

    const replyResponse = await clients[1].post('/api/quacks', {
      data: { text: `${marker} reply`, parentId: quack.id },
    });
    expect(replyResponse.status()).toBe(201);
    const reply = await replyResponse.json();
    expect(reply).toMatchObject({
      rootId: quack.id,
      parentId: quack.id,
      userId: userIds[1],
    });
    expect((await clients[0].delete(`/api/quacks/${reply.id}`)).status()).toBe(
      403,
    );
    const nestedResponse = await clients[0].post('/api/quacks', {
      data: { text: `${marker} nested`, parentId: reply.id },
    });
    expect(nestedResponse.status()).toBe(201);
    expect(await nestedResponse.json()).toMatchObject({
      rootId: quack.id,
      parentId: reply.id,
    });
    await observer.goto(`/quacks/${quack.id}`);
    await expect(
      observer.getByRole('article').filter({ hasText: marker }).first(),
    ).toBeVisible();

    // A direct HTTP request also cannot bypass authorization.
    const denied = await clients[1].delete(`/api/quacks/${quack.id}`);
    expect(denied.status()).toBe(403);
    const preserved = await clients[0].get(`/api/quacks/${quack.id}`);
    expect(preserved.status()).toBe(200);

    await page.reload();
    const article = page.getByRole('article').filter({ hasText: marker });
    await expect(article).toBeVisible();
    await expect(
      article.getByRole('button', { name: 'Delete', exact: true }),
    ).toBeVisible();
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('cannot be undone');
      await dialog.accept();
    });
    const deleted = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/quacks/${quack.id}`) &&
        response.request().method() === 'DELETE',
    );
    await article.getByRole('button', { name: 'Delete', exact: true }).click();
    expect((await deleted).status()).toBe(204);
    await expect(article).toHaveCount(0);
    const tombstone = await clients[0].get(`/api/quacks/${quack.id}`);
    expect(tombstone.status()).toBe(200);
    expect(await tombstone.json()).toMatchObject({
      text: null,
      userId: null,
      user: null,
      replyCount: 2,
    });
    await expect(observer.locator(`#quack-${quack.id}`)).toContainText(
      'This quack was deleted',
    );
    await expect(observer.locator(`#quack-${reply.id}`)).toContainText(
      `${marker} reply`,
    );
    const preservedReply = await clients[1].get(`/api/quacks/${reply.id}`);
    expect(await preservedReply.json()).toMatchObject({
      text: `${marker} reply`,
      parent: { text: null, user: null },
    });
    await page
      .locator(`#quack-${quack.id}`)
      .getByRole('link', { name: 'Replies (2)' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Discussion', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Reply', exact: true })
      .fill(`${marker} after deletion`);
    await page
      .getByRole('button', { name: 'Reply', exact: true })
      .last()
      .click();
    await expect(
      page.getByRole('article').filter({ hasText: `${marker} after deletion` }),
    ).toBeVisible();
  } finally {
    // Erase only this run's content before deleting its disposable accounts.
    try {
      if (userIds.length) {
        await database.query(
          'DELETE FROM poll WHERE "quackId" IN (SELECT id FROM quack WHERE "userId" = ANY($1::text[]))',
          [userIds],
        );
        await database.query(
          'UPDATE quack SET text = NULL, mood = NULL, "userId" = NULL, "deletedAt" = now(), "updatedAt" = now() WHERE "userId" = ANY($1::text[])',
          [userIds],
        );
        await database.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
          userIds,
        ]);
      }
    } finally {
      await observer.close();
      await Promise.all(clients.map((client) => client.dispose()));
      await database.end();
    }
  }
});
