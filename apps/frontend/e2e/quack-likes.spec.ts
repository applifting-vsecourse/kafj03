import { expect, test as base } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';

const backendRequire = createRequire(path.resolve('apps/backend/package.json'));
backendRequire('dotenv').config({ path: 'apps/backend/.env', quiet: true });
const { Pool } = backendRequire('pg');
const backendURL = process.env.E2E_BACKEND_URL ?? 'http://localhost:4050';
const quacksURL = `${backendURL}/api/quacks`;

type LikesFixtures = {
  signIn(): Promise<Page>;
  publish(page: Page, parentId?: string): Promise<string>;
};

const test = base.extend<{ likes: LikesFixtures }>({
  likes: async ({ browser, baseURL }, use) => {
    const contexts: BrowserContext[] = [];
    const userIds: string[] = [];
    const quacks: { id: string; page: Page }[] = [];

    try {
      await use({
        async signIn() {
          const context = await browser.newContext({ baseURL });
          contexts.push(context);
          const response = await context.request.post(
            `${backendURL}/api/auth/sign-up/email`,
            {
              headers: { Origin: baseURL ?? 'http://localhost:3050' },
              data: {
                name: 'Like test user',
                email: `likes-${randomUUID()}@example.invalid`,
                password: `like-test-${randomUUID()}`,
              },
            },
          );
          expect(
            response.status(),
            'BetterAuth creates a browser session',
          ).toBe(200);
          const body = (await response.json()) as { user: { id: string } };
          userIds.push(body.user.id);
          return context.newPage();
        },

        async publish(page, parentId) {
          const response = await page.request.post(quacksURL, {
            data: { text: `Quack for likes ${randomUUID()}`, parentId },
          });
          expect(response.status(), 'fixture quack is published').toBe(201);
          const { id } = (await response.json()) as { id: string };
          quacks.push({ id, page });
          return id;
        },
      });
    } finally {
      try {
        for (const { id, page } of quacks.reverse()) {
          const response = await page.request.delete(`${quacksURL}/${id}`);
          expect(response.status(), 'fixture quack is erased').toBe(204);
        }
        if (userIds.length) {
          const database = new Pool({
            connectionString: process.env.DATABASE_URL,
          });
          try {
            await database.query(
              'DELETE FROM "user" WHERE id = ANY($1::text[])',
              [userIds],
            );
          } finally {
            await database.end();
          }
        }
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    }
  },
});

const quack = (page: Page, id: string): Locator => page.locator(`#quack-${id}`);
const likeButton = (item: Locator): Locator =>
  item.getByRole('button', { name: 'Like', exact: true });
const likeCount = (item: Locator): Locator => item.getByTestId('like-count');

async function expectLike(
  item: Locator,
  count: number,
  pressed: boolean,
): Promise<void> {
  await expect(item, 'the quack is rendered').toBeVisible();
  await expect(
    likeButton(item),
    'Like exposes the current user’s pressed state',
  ).toHaveAttribute('aria-pressed', String(pressed));
  await expect(
    likeCount(item),
    'the quack shows the total number of likes',
  ).toHaveText(String(count));
}

test('E1 likes and unlikes in the feed and keeps both states after reload', async ({
  likes,
}) => {
  const page = await likes.signIn();
  const id = await likes.publish(page);
  await page.goto('/quacks');
  const item = quack(page, id);

  await expectLike(item, 0, false);
  await likeButton(item).click();
  await expectLike(item, 1, true);
  await page.reload();
  await expectLike(item, 1, true);
  await likeButton(item).click();
  await expectLike(item, 0, false);
  await page.reload();
  await expectLike(item, 0, false);
});

test('E2 sees another user’s like after reloading the feed', async ({
  likes,
}) => {
  const a = await likes.signIn();
  const b = await likes.signIn();
  const id = await likes.publish(b);
  await b.goto('/quacks');
  await expectLike(quack(b, id), 0, false);

  await a.goto('/quacks');
  await expectLike(quack(a, id), 0, false);
  await likeButton(quack(a, id)).click();
  await expectLike(quack(a, id), 1, true);

  await b.reload();
  await expectLike(quack(b, id), 1, false);
});

test('E3 can like a live reply but sees no like controls on the erased root', async ({
  likes,
}) => {
  const page = await likes.signIn();
  const id = await likes.publish(page);
  const replyId = await likes.publish(page, id);
  expect((await page.request.delete(`${quacksURL}/${id}`)).status()).toBe(204);
  await page.goto(`/quacks/${id}`);

  const root = quack(page, id);
  const reply = quack(page, replyId);
  await expect(root).toContainText('This quack was deleted');
  await expect(likeButton(root)).toHaveCount(0);
  await expect(likeCount(root)).toHaveCount(0);
  await expectLike(reply, 0, false);
  await likeButton(reply).click();
  await expectLike(reply, 1, true);
});

for (const { action, method } of [
  { action: 'adding', method: 'PUT' },
  { action: 'removing', method: 'DELETE' },
] as const) {
  test(`E4 keeps the confirmed state when ${action} a like fails`, async ({
    likes,
    baseURL,
  }) => {
    const page = await likes.signIn();
    const id = await likes.publish(page);
    await page.goto('/quacks');
    const item = quack(page, id);
    await expectLike(item, 0, false);

    const initiallyLiked = method === 'DELETE';
    if (initiallyLiked) {
      await likeButton(item).click();
      await expectLike(item, 1, true);
    }

    const mutationURL = `${quacksURL}/${id}/like`;
    await page.route(mutationURL, async (route) => {
      if (route.request().method() !== method) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': new URL(
            baseURL ?? 'http://localhost:3050',
          ).origin,
          'Access-Control-Allow-Credentials': 'true',
        },
        json: { message: 'Like service unavailable' },
      });
    });
    const failed = page.waitForResponse(
      (response) =>
        response.url() === mutationURL &&
        response.request().method() === method,
    );
    await likeButton(item).click();
    expect((await failed).status()).toBe(503);
    await expect(
      page.getByRole('alert').filter({ hasText: /like/i }),
    ).toBeVisible();
    await expectLike(item, initiallyLiked ? 1 : 0, initiallyLiked);
  });
}
