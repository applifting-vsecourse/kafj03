const { Client } = require('pg');

async function resetDatabase() {
  const database = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await database.connect();
    // The DO block makes truncation and trigger restoration atomic.
    await database.query(`
      DO $$
      DECLARE tables text;
      BEGIN
        IF current_database() <> 'quacker_test' THEN
          RAISE EXCEPTION 'Integration test cleanup requires quacker_test';
        END IF;

        SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
          INTO tables
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> '_prisma_migrations';

        ALTER TABLE public.quack DISABLE TRIGGER quack_no_truncate;
        EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY';
        ALTER TABLE public.quack ENABLE TRIGGER quack_no_truncate;
      END $$;
    `);
  } finally {
    await database.end();
  }
}

beforeEach(resetDatabase);
afterAll(resetDatabase);
