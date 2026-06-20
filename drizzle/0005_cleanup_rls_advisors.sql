ALTER POLICY "users_select_own" ON "users" USING ("id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "coin_ledger_select_own" ON "coin_ledger_entries" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "xp_ledger_select_own" ON "xp_ledger_entries" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "daily_checkins_select_own" ON "daily_checkins" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "life_habit_checkins_select_own" ON "life_habit_checkins" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "workout_sessions_select_own" ON "workout_sessions" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "workout_entries_select_own" ON "workout_entries" USING (
  EXISTS (
    SELECT 1
    FROM "workout_sessions"
    WHERE "workout_sessions"."id" = "workout_entries"."session_id"
      AND "workout_sessions"."user_id" = ((SELECT auth.jwt()) ->> 'sub')
  )
);--> statement-breakpoint
ALTER POLICY "user_quests_select_own" ON "user_quests" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "user_rewards_select_own" ON "user_rewards" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
ALTER POLICY "user_weekly_goals_select_own" ON "user_weekly_goals" USING ("user_id" = ((SELECT auth.jwt()) ->> 'sub'));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_quests_quest_idx" ON "user_quests" USING btree ("quest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_rewards_reward_idx" ON "user_rewards" USING btree ("reward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workout_entries_exercise_idx" ON "workout_entries" USING btree ("exercise_id");
