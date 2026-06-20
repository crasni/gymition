CREATE TYPE "public"."workout_mode" AS ENUM('detailed', 'simple');--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "mode" "workout_mode" DEFAULT 'detailed' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "notes" text;