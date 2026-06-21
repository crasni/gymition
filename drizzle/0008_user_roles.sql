DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM ('user', 'tester');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS "users_role_leaderboard_idx"
ON "users" USING btree ("role", "current_streak", "xp");

DROP INDEX IF EXISTS "users_leaderboard_visible_idx";

ALTER TABLE "users" DROP COLUMN IF EXISTS "is_admin";
