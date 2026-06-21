ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_leaderboard_visible_idx" ON "users" USING btree ("is_admin", "current_streak", "xp");--> statement-breakpoint
