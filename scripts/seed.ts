import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { notInArray } from "drizzle-orm";
import postgres from "postgres";
import { seedExercises } from "../src/features/exercises/seed-exercises";
import { dailyQuests } from "../src/features/quests/quest-rules";
import { seedRewards } from "../src/features/rewards/reward-service";
import * as schema from "../src/db/schema";

config({ path: ".env.local" });
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const sql = postgres(databaseUrl, { prepare: false });
const db = drizzle(sql, { schema });

async function seed() {
  await db.transaction(async (tx) => {
    for (const exercise of seedExercises) {
      await tx
        .insert(schema.exercises)
        .values({
          id: exercise.id,
          name: exercise.name,
          category: exercise.category,
          measurementType: exercise.measurementType,
          defaultCoinValue: exercise.defaultCoinValue,
          isActive: exercise.isActive,
        })
        .onConflictDoUpdate({
          target: schema.exercises.id,
          set: {
            name: exercise.name,
            category: exercise.category,
            measurementType: exercise.measurementType,
            defaultCoinValue: exercise.defaultCoinValue,
            isActive: exercise.isActive,
          },
        });
    }

    for (const quest of dailyQuests) {
      await tx
        .insert(schema.quests)
        .values({
          id: quest.id,
          code: quest.code,
          name: quest.name,
          description: quest.description,
          period: quest.period,
          targetType: quest.targetType,
          targetValue: quest.targetValue,
          category: quest.category,
          coinReward: quest.coinReward,
          xpReward: quest.xpReward,
          isActive: quest.isActive,
        })
        .onConflictDoUpdate({
          target: schema.quests.code,
          set: {
            name: quest.name,
            description: quest.description,
            period: quest.period,
            targetType: quest.targetType,
            targetValue: quest.targetValue,
            category: quest.category,
            coinReward: quest.coinReward,
            xpReward: quest.xpReward,
            isActive: quest.isActive,
          },
        });
    }

    for (const reward of seedRewards) {
      await tx
        .insert(schema.rewards)
        .values({
          id: reward.id,
          name: reward.name,
          description: reward.description,
          cost: reward.cost,
          type: reward.type,
          metadata: reward.metadata,
          isActive: reward.isActive,
        })
        .onConflictDoUpdate({
          target: schema.rewards.id,
          set: {
            name: reward.name,
            description: reward.description,
            cost: reward.cost,
            type: reward.type,
            metadata: reward.metadata,
            isActive: reward.isActive,
          },
        });
    }

    await tx
      .update(schema.rewards)
      .set({ isActive: false })
      .where(notInArray(schema.rewards.id, seedRewards.map((reward) => reward.id)));
  });
}

seed()
  .then(async () => {
    await sql.end();
  })
  .catch(async (error) => {
    await sql.end();
    console.error(error);
    process.exit(1);
  });
