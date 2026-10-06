CREATE TYPE "quack_mood" AS ENUM ('happy', 'sad', 'angry', 'silly');

ALTER TABLE "quack" ADD COLUMN "mood" "quack_mood";
