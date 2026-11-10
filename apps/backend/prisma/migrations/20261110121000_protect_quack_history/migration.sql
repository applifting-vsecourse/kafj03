-- Row DELETE guards do not protect TRUNCATE. Explicit development resets drop
-- and recreate the schema; ordinary application/seed writes must preserve links.
CREATE FUNCTION prevent_quack_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Quack history cannot be truncated' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER quack_no_truncate BEFORE TRUNCATE ON quack
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_quack_truncate();

-- Prisma stores DateTime in UTC in timestamp-without-time-zone columns. Include
-- an explicit zone on the wire so clients in other time zones keep the instant.
CREATE OR REPLACE FUNCTION notify_quack_erasure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL THEN
    PERFORM pg_notify('quack_erased', json_build_object(
      'quackId', NEW.id, 'rootId', COALESCE(NEW."rootId", NEW.id),
      'deletedAt', to_char(NEW."deletedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )::text);
  END IF;
  RETURN NEW;
END;
$$;
