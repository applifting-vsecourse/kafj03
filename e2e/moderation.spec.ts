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
    expect((await clients[0].get(`/api/quacks/${quack.id}`)).status()).toBe(
      404,
    );
  } finally {
    // Cascades remove only this run's accounts, sessions and quacks.
    try {
      if (userIds.length) {
        await database.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [
          userIds,
        ]);
      }
    } finally {
      await Promise.all(clients.map((client) => client.dispose()));
      await database.end();
    }
  }
});
