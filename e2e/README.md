# Playwright E2E tests

Run against the existing local frontend, backend and migrated PostgreSQL database:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Defaults are `http://localhost:3050` and `http://localhost:4050`. Override them with `E2E_FRONTEND_URL` and `E2E_BACKEND_URL`. The database connection comes from `DATABASE_URL`, falling back to `apps/backend/.env`; it must point to the same database as the backend.

The moderation test creates three disposable accounts through BetterAuth, assigns the admin role directly in the database, and creates a quack owned by the author. It checks that a signed-out DELETE returns 401 and that a regular user's direct DELETE returns 403 without deleting the post, then signs the admin into the browser and deletes the post through the UI. It checks HTTP 204, disappearance from the feed and HTTP 404 on a subsequent GET. Cleanup removes only the accounts created by that run and their cascading data.

No application servers are started by the test configuration. Playwright traces are retained on failure in the ignored `test-results/` directory.

The service authorization was verified by temporarily disabling its condition: the test failed with `Expected: 403, Received: 204`. The original condition was then restored and the test rerun.
