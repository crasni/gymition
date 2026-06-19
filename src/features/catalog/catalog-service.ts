import { and, eq } from "drizzle-orm";
import type { DbClient } from "@/db/client";
import { exercises, quests, rewards } from "@/db/schema";

export async function listActiveExercises(db: DbClient) {
  return db.select().from(exercises).where(eq(exercises.isActive, true));
}

export async function listActiveDailyQuests(db: DbClient) {
  return db
    .select()
    .from(quests)
    .where(and(eq(quests.isActive, true), eq(quests.period, "daily")));
}

export async function listActiveRewards(db: DbClient) {
  return db.select().from(rewards).where(eq(rewards.isActive, true));
}
