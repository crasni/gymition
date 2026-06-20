CREATE TABLE "daily_checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"checkin_date" date NOT NULL,
	"streak_day" integer NOT NULL,
	"coins_earned" integer DEFAULT 0 NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"streak_bonus_coins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_weekly_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"workout_target" integer NOT NULL,
	"cardio_target" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_weekly_goals" ADD CONSTRAINT "user_weekly_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checkins_user_date_unique" ON "daily_checkins" USING btree ("user_id","checkin_date");--> statement-breakpoint
CREATE INDEX "daily_checkins_user_created_idx" ON "daily_checkins" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_weekly_goals_user_week_unique" ON "user_weekly_goals" USING btree ("user_id","week_start");--> statement-breakpoint
CREATE INDEX "user_weekly_goals_user_idx" ON "user_weekly_goals" USING btree ("user_id");