const { execFileSync } = require('node:child_process');
const { Client } = require('pg');

async function connectToTestDatabase(databaseUrl) {
  const testDatabase = new Client({ connectionString: databaseUrl.href });
  try {
    await testDatabase.connect();
    return testDatabase;
  } catch (error) {
    await testDatabase.end();
    if (error.code !== '3D000') throw error; // Database does not exist yet.
  }

  const maintenanceUrl = new URL('/postgres', databaseUrl);
  const maintenance = new Client({ connectionString: maintenanceUrl.href });
  try {
    await maintenance.connect();
    await maintenance.query('SELECT pg_advisory_lock(40503050)');
    const { rowCount } = await maintenance.query(
      "SELECT 1 FROM pg_database WHERE datname = 'quacker_test'",
    );
    if (!rowCount) await maintenance.query('CREATE DATABASE quacker_test');
  } finally {
    await maintenance.end();
  }

  const database = new Client({ connectionString: databaseUrl.href });
  await database.connect();
  return database;
}

async function run() {
  const databaseUrl = new URL(
    process.env.TEST_DATABASE_URL ??
      'postgresql://quacker:quacker@localhost:5433/quacker_test',
  );
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname ||
    databaseUrl.pathname !== '/quacker_test' ||
    databaseUrl.search ||
    databaseUrl.hash
  ) {
    throw new Error(
      'TEST_DATABASE_URL must point to quacker_test without URL options',
    );
  }

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl.href,
    BETTER_AUTH_SECRET: 'integration-test-secret-for-local-use-only',
    BACKEND_URL: 'http://localhost:4050',
    FRONTEND_URL: 'http://localhost:3050',
  };
  const options = { env, stdio: 'inherit' };

  const lock = await connectToTestDatabase(databaseUrl);
  try {
    // Separate local runs must not truncate each other's fixtures.
    const {
      rows: [{ acquired }],
    } = await lock.query('SELECT pg_try_advisory_lock(40503050) AS acquired');
    if (!acquired)
      throw new Error('Integration tests are already using quacker_test');

    execFileSync('pnpm', ['migrate'], options);
    execFileSync('pnpm', ['prisma:generate'], options);
    execFileSync(
      process.execPath,
      [
        // Jest needs VM modules to load BetterAuth's ESM from CommonJS tests.
        '--experimental-vm-modules',
        require.resolve('jest/bin/jest'),
        '--config',
        'jest.integration.config.cjs',
        '--runInBand',
        ...process.argv.slice(2),
      ],
      options,
    );
  } finally {
    await lock.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = error.status || 1;
});
