CREATE TYPE "public"."exercise_category" AS ENUM('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'mobility');--> statement-breakpoint
CREATE TYPE "public"."ledger_reason" AS ENUM('daily_login', 'workout_completed', 'exercise_logged', 'quest_completed', 'streak_bonus', 'reward_purchase', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."ledger_source_type" AS ENUM('login', 'workout', 'workout_entry', 'quest', 'reward', 'manual');--> statement-breakpoint
CREATE TYPE "public"."measurement_type" AS ENUM('reps_weight', 'reps_only', 'duration', 'distance', 'completion');--> statement-breakpoint
CREATE TYPE "public"."quest_period" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."quest_target_type" AS ENUM('workout_completed', 'exercise_count', 'category_logged', 'duration_seconds');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('title', 'badge', 'theme', 'avatar_item', 'custom');--> statement-breakpoint
CREATE TYPE "public"."workout_status" AS ENUM('draft', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "coin_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"source_type" "ledger_source_type" NOT NULL,
	"source_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "exercise_category" NOT NULL,
	"measurement_type" "measurement_type" NOT NULL,
	"default_coin_value" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"period" "quest_period" NOT NULL,
	"target_type" "quest_target_type" NOT NULL,
	"target_value" integer NOT NULL,
	"category" "exercise_category",
	"coin_reward" integer DEFAULT 0 NOT NULL,
	"xp_reward" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"cost" integer NOT NULL,
	"type" "reward_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_quests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_rewards" (
	"user_id" text NOT NULL,
	"reward_id" text NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"equipped_at" timestamp with time zone,
	CONSTRAINT "user_rewards_user_id_reward_id_pk" PRIMARY KEY("user_id","reward_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"last_login_reward_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"sets" integer,
	"reps" integer,
	"weight" integer,
	"duration_seconds" integer,
	"distance_meters" integer,
	"notes" text,
	"coins_earned" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" "workout_status" DEFAULT 'draft' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"total_coins_earned" integer DEFAULT 0 NOT NULL,
	"total_xp_earned" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"source_type" "ledger_source_type" NOT NULL,
	"source_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coin_ledger_entries" ADD CONSTRAINT "coin_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rewards" ADD CONSTRAINT "user_rewards_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_entries" ADD CONSTRAINT "workout_entries_session_id_workout_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_entries" ADD CONSTRAINT "workout_entries_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_ledger_entries" ADD CONSTRAINT "xp_ledger_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coin_ledger_user_created_idx" ON "coin_ledger_entries" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quests_code_unique" ON "quests" USING btree ("code");--> statement-breakpoint
CREATE INDEX "user_quests_user_period_idx" ON "user_quests" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "user_quests_unique_period" ON "user_quests" USING btree ("user_id","quest_id","period_start");--> statement-breakpoint
CREATE INDEX "user_rewards_user_idx" ON "user_rewards" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workout_entries_session_idx" ON "workout_entries" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "workout_sessions_user_completed_idx" ON "workout_sessions" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "xp_ledger_user_created_idx" ON "xp_ledger_entries" USING btree ("user_id","created_at");