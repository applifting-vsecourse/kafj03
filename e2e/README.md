# Playwright E2E tests

Run against the existing local frontend, backend and migrated PostgreSQL database:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

Defaults are `http://localhost:3050` and `http://localhost:4050`. Override them with `E2E_FRONTEND_URL` and `E2E_BACKEND_URL`. The database connection comes from `DATABASE_URL`, falling back to `apps/backend/.env`; it must point to the same database as the backend.

The moderation test creates three disposable accounts through BetterAuth, assigns the admin role directly in the database, and creates a quack owned by the author. It checks that a signed-out DELETE returns 401 and that a regular user's direct DELETE returns 403 without deleting the post, then signs the admin into the browser and deletes the post through the UI. It creates direct and nested replies, checks that the root author cannot delete a foreign reply, and verifies HTTP 204 plus an anonymous HTTP 200 tombstone after moderation. A second browser tab must receive the deletion, keep the replies and remove the parent preview; posting to the erased root remains possible. Cleanup erases only this run’s content before removing its disposable accounts. Anonymous structural rows remain by design.

No application servers are started by the test configuration. Playwright traces are retained on failure in the ignored `test-results/` directory.

## PostgreSQL and HTTP integration tests

Use a disposable, migrated PostgreSQL database via `DATABASE_URL`, then run `pnpm backend test:quacks:integration`. This runs real repository/constraint/concurrency tests plus HTTP controller/service tests using isolated test sessions. The HTTP suite substitutes only the session adapter; the Playwright suite above additionally covers real BetterAuth sessions and the browser.

To verify that the HTTP permission assertion catches missing server checks, run the HTTP suite with `POLL_DB_TESTS=1 AUTHORIZATION_MUTANT=1` and `--testPathPatterns=quacks.http.integration`. This intentionally bypasses both authorization layers inside that test process and must fail with expected 403 / received 204. Run again without `AUTHORIZATION_MUTANT` to verify the unchanged production checks. The probe does not edit production source.

Integration fixtures use unique IDs and clean up only their own accounts/content. Run in a disposable database because anonymous structural rows intentionally survive cleanup. The new replies migration must be applied before running these tests; unit tests need no database.
