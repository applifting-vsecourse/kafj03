-- Existing posts become live roots; no content or authorship is rewritten.
ALTER TABLE "quack"
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "rootId" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ALTER COLUMN "text" DROP NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "quack" DROP CONSTRAINT "quack_userId_fkey";
ALTER TABLE "quack" ADD CONSTRAINT "quack_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "quack" ADD CONSTRAINT "quack_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "quack"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "quack" ADD CONSTRAINT "quack_rootId_fkey"
  FOREIGN KEY ("rootId") REFERENCES "quack"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "quack" ADD CONSTRAINT "quack_thread_shape" CHECK (
  ("parentId" IS NULL AND "rootId" IS NULL) OR
  ("parentId" IS NOT NULL AND "rootId" IS NOT NULL AND "parentId" <> id AND "rootId" <> id)
);
ALTER TABLE "quack" ADD CONSTRAINT "quack_content_state" CHECK (
  ("deletedAt" IS NULL AND text IS NOT NULL AND "userId" IS NOT NULL) OR
  ("deletedAt" IS NOT NULL AND text IS NULL AND "userId" IS NULL AND mood IS NULL)
);
DROP INDEX "quack_userId_idx";
CREATE INDEX "quack_userId_createdAt_id_idx" ON "quack"("userId", "createdAt", id);
CREATE INDEX "quack_parentId_createdAt_id_idx" ON "quack"("parentId", "createdAt", id);
CREATE INDEX "quack_rootId_createdAt_id_idx" ON "quack"("rootId", "createdAt", id);
CREATE INDEX "quack_rootId_deletedAt_idx" ON "quack"("rootId", "deletedAt");

CREATE FUNCTION enforce_quack_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_root TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Quacks must be erased, not physically deleted' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW."parentId", NEW."rootId", NEW."createdAt") IS DISTINCT FROM
       (OLD.id, OLD."parentId", OLD."rootId", OLD."createdAt") THEN
      RAISE EXCEPTION 'Quack identity and thread are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."deletedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Erasure is irreversible' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW."parentId" IS NOT NULL THEN
    -- Parent links are immutable; existing parents cannot introduce a cycle.
    SELECT COALESCE("rootId", id) INTO parent_root FROM quack WHERE id = NEW."parentId";
    IF NOT FOUND OR parent_root IS DISTINCT FROM NEW."rootId" OR NOT EXISTS (
      SELECT 1 FROM quack WHERE id = NEW."rootId" AND "parentId" IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid reply parent or root' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."deletedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM poll WHERE "quackId" = NEW.id) THEN
    RAISE EXCEPTION 'Erased quacks cannot contain a poll' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quack_lifecycle BEFORE INSERT OR UPDATE OR DELETE ON quack
  FOR EACH ROW EXECUTE FUNCTION enforce_quack_lifecycle();

CREATE FUNCTION enforce_live_poll() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE erased TIMESTAMP(3);
BEGIN
  -- Serialize with the quack UPDATE even for writes bypassing the repository.
  SELECT "deletedAt" INTO erased FROM quack WHERE id = NEW."quackId" FOR UPDATE;
  IF NOT FOUND OR erased IS NOT NULL THEN
    RAISE EXCEPTION 'Poll requires a live quack' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER poll_live_quack BEFORE INSERT OR UPDATE OF "quackId" ON poll
  FOR EACH ROW EXECUTE FUNCTION enforce_live_poll();

CREATE FUNCTION notify_quack_erasure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL THEN
    PERFORM pg_notify('quack_erased', json_build_object(
      'quackId', NEW.id, 'rootId', COALESCE(NEW."rootId", NEW.id), 'deletedAt', NEW."deletedAt"
    )::text);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER quack_erasure AFTER UPDATE ON quack
  FOR EACH ROW EXECUTE FUNCTION notify_quack_erasure();

-- These historical rows deliberately have no FK. Remove old orphan identities.
DELETE FROM poll_voter_usage v WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = v."userId");
CREATE FUNCTION erase_voter_usage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM poll_voter_usage WHERE "userId" = OLD.id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER user_voter_usage BEFORE DELETE ON "user"
  FOR EACH ROW EXECUTE FUNCTION erase_voter_usage();
