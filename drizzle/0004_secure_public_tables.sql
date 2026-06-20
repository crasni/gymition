ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coin_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "xp_ledger_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "life_habit_checkins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workout_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workout_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_quests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_rewards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_weekly_goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rewards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "catalog_read_exercises" ON "exercises" FOR SELECT TO anon, authenticated USING ("is_active" = true);--> statement-breakpoint
CREATE POLICY "catalog_read_quests" ON "quests" FOR SELECT TO anon, authenticated USING ("is_active" = true);--> statement-breakpoint
CREATE POLICY "catalog_read_rewards" ON "rewards" FOR SELECT TO anon, authenticated USING ("is_active" = true);--> statement-breakpoint
CREATE POLICY "users_select_own" ON "users" FOR SELECT TO authenticated USING ("id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "coin_ledger_select_own" ON "coin_ledger_entries" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "xp_ledger_select_own" ON "xp_ledger_entries" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "daily_checkins_select_own" ON "daily_checkins" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "life_habit_checkins_select_own" ON "life_habit_checkins" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "workout_sessions_select_own" ON "workout_sessions" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "workout_entries_select_own" ON "workout_entries" FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM "workout_sessions"
    WHERE "workout_sessions"."id" = "workout_entries"."session_id"
      AND "workout_sessions"."user_id" = (auth.jwt() ->> 'sub')
  )
);--> statement-breakpoint
CREATE POLICY "user_quests_select_own" ON "user_quests" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "user_rewards_select_own" ON "user_rewards" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));--> statement-breakpoint
CREATE POLICY "user_weekly_goals_select_own" ON "user_weekly_goals" FOR SELECT TO authenticated USING ("user_id" = (auth.jwt() ->> 'sub'));
