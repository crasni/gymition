CREATE TYPE "public"."life_habit_type" AS ENUM('face_wash', 'tooth_brush');--> statement-breakpoint
CREATE TABLE "life_habit_checkins" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"checkin_date" date NOT NULL,
	"habit_type" "life_habit_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "life_habit_checkins" ADD CONSTRAINT "life_habit_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "life_habit_checkins_user_date_type_unique" ON "life_habit_checkins" USING btree ("user_id","checkin_date","habit_type");--> statement-breakpoint
CREATE INDEX "life_habit_checkins_user_date_idx" ON "life_habit_checkins" USING btree ("user_id","checkin_date");