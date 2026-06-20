"use server";

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import {
  coinLedgerEntries,
  exercises,
  quests,
  userQuests,
  users,
  workoutEntries,
  workoutSessions,
  xpLedgerEntries,
} from "@/db/schema";
import { REWARD_RULES } from "@/features/economy/reward-rules";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";
import { completeWorkoutSchema, type CompleteWorkoutInput } from "./workout-validation";

function dayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function completeWorkoutAction(input: unknown) {
  const parsed = completeWorkoutSchema.parse(input);
  const appUser = await requireCurrentAppUser();
  const db = getDb();
  const now = new Date();
  const today = localDateKey(now);
  const { start, end } = dayRange(today);

  await db.transaction(async (tx) => {
    const activeExercises = await tx.select().from(exercises).where(eq(exercises.isActive, true));
    const exerciseById = new Map(activeExercises.map((exercise) => [exercise.id, exercise]));
    const sanitizedEntries: CompleteWorkoutInput["entries"] = parsed.entries.map((entry) => {
      const exercise = exerciseById.get(entry.exerciseId);

      if (!exercise) {
        throw new Error("Invalid exercise.");
      }

      const needsReps = exercise.measurementType === "reps_weight" || exercise.measurementType === "reps_only";
      if (needsReps && (!entry.sets || !entry.reps)) {
        throw new Error("Sets and reps are required.");
      }

      if (exercise.measurementType === "duration" && !entry.durationSeconds) {
        throw new Error("Duration is required.");
      }

      return {
        ...entry,
        sets: exercise.measurementType === "reps_weight" || exercise.measurementType === "reps_only" ? entry.sets : undefined,
        reps: exercise.measurementType === "reps_weight" || exercise.measurementType === "reps_only" ? entry.reps : undefined,
        weight: exercise.measurementType === "reps_weight" ? entry.weight : undefined,
        durationSeconds: exercise.measurementType === "duration" ? entry.durationSeconds : undefined,
        distanceMeters: exercise.measurementType === "distance" ? entry.distanceMeters : undefined,
      };
    });

    const workoutId = createId("workout");
    const exerciseCoins = sanitizedEntries.length * REWARD_RULES.exerciseLogged.coins;
    const exerciseXp = sanitizedEntries.length * REWARD_RULES.exerciseLogged.xp;
    let totalCoins = exerciseCoins + REWARD_RULES.workoutCompleted.coins;
    let totalXp = exerciseXp + REWARD_RULES.workoutCompleted.xp;

    await tx.insert(workoutSessions).values({
      id: workoutId,
      userId: appUser.id,
      status: "completed",
      startedAt: now,
      completedAt: now,
      totalCoinsEarned: totalCoins,
      totalXpEarned: totalXp,
    });

    const entryRows = sanitizedEntries.map((entry) => ({
      id: createId("entry"),
      sessionId: workoutId,
      exerciseId: entry.exerciseId,
      sets: entry.sets,
      reps: entry.reps,
      weight: entry.weight,
      durationSeconds: entry.durationSeconds,
      distanceMeters: entry.distanceMeters,
      notes: entry.notes?.trim() || null,
      coinsEarned: REWARD_RULES.exerciseLogged.coins,
      xpEarned: REWARD_RULES.exerciseLogged.xp,
    }));

    await tx.insert(workoutEntries).values(entryRows);

    await tx.insert(coinLedgerEntries).values([
      ...entryRows.map((entry) => ({
        id: createId("coin_ledger"),
        userId: appUser.id,
        amount: REWARD_RULES.exerciseLogged.coins,
        reason: "exercise_logged" as const,
        sourceType: "workout_entry" as const,
        sourceId: entry.id,
      })),
      {
        id: createId("coin_ledger"),
        userId: appUser.id,
        amount: REWARD_RULES.workoutCompleted.coins,
        reason: "workout_completed",
        sourceType: "workout",
        sourceId: workoutId,
      },
    ]);

    await tx.insert(xpLedgerEntries).values([
      ...entryRows.map((entry) => ({
        id: createId("xp_ledger"),
        userId: appUser.id,
        amount: REWARD_RULES.exerciseLogged.xp,
        reason: "exercise_logged" as const,
        sourceType: "workout_entry" as const,
        sourceId: entry.id,
      })),
      {
        id: createId("xp_ledger"),
        userId: appUser.id,
        amount: REWARD_RULES.workoutCompleted.xp,
        reason: "workout_completed",
        sourceType: "workout",
        sourceId: workoutId,
      },
    ]);

    const todaysSessions = await tx
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, appUser.id),
          eq(workoutSessions.status, "completed"),
          gte(workoutSessions.completedAt, start),
          lt(workoutSessions.completedAt, end),
        ),
      );
    const todaysSessionIds = new Set(todaysSessions.map((session) => session.id));
    const todaysEntries = todaysSessionIds.size
      ? await tx
          .select()
          .from(workoutEntries)
          .where(inArray(workoutEntries.sessionId, [...todaysSessionIds]))
      : [];
    const activeDailyQuests = await tx
      .select()
      .from(quests)
      .where(and(eq(quests.isActive, true), eq(quests.period, "daily")));

    for (const quest of activeDailyQuests) {
      const [existingQuest] = await tx
        .select()
        .from(userQuests)
        .where(
          and(
            eq(userQuests.userId, appUser.id),
            eq(userQuests.questId, quest.id),
            eq(userQuests.periodStart, today),
          ),
        )
        .limit(1);

      if (existingQuest?.claimedAt) {
        continue;
      }

      const relevantEntries = todaysEntries.filter((entry) => todaysSessionIds.has(entry.sessionId));
      let progress = 0;

      if (quest.targetType === "workout_completed") {
        progress = todaysSessions.length;
      }

      if (quest.targetType === "exercise_count") {
        progress = relevantEntries.length;
      }

      if (quest.targetType === "category_logged") {
        progress = relevantEntries.filter(
          (entry) => exerciseById.get(entry.exerciseId)?.category === quest.category,
        ).length;
      }

      if (quest.targetType === "duration_seconds") {
        progress = relevantEntries.reduce((total, entry) => {
          const exercise = exerciseById.get(entry.exerciseId);
          return exercise?.category === quest.category ? total + (entry.durationSeconds ?? 0) : total;
        }, 0);
      }

      if (progress < quest.targetValue) {
        if (existingQuest) {
          await tx
            .update(userQuests)
            .set({ progress })
            .where(eq(userQuests.id, existingQuest.id));
        } else {
          await tx.insert(userQuests).values({
            id: createId("user_quest"),
            userId: appUser.id,
            questId: quest.id,
            periodStart: today,
            periodEnd: today,
            progress,
          });
        }
        continue;
      }

      const claimedAt = new Date();
      if (existingQuest) {
        await tx
          .update(userQuests)
          .set({ progress, completedAt: claimedAt, claimedAt })
          .where(eq(userQuests.id, existingQuest.id));
      } else {
        await tx.insert(userQuests).values({
          id: createId("user_quest"),
          userId: appUser.id,
          questId: quest.id,
          periodStart: today,
          periodEnd: today,
          progress,
          completedAt: claimedAt,
          claimedAt,
        });
      }

      totalCoins += quest.coinReward;
      totalXp += quest.xpReward;

      await tx.insert(coinLedgerEntries).values({
        id: createId("coin_ledger"),
        userId: appUser.id,
        amount: quest.coinReward,
        reason: "quest_completed",
        sourceType: "quest",
        sourceId: quest.id,
      });

      await tx.insert(xpLedgerEntries).values({
        id: createId("xp_ledger"),
        userId: appUser.id,
        amount: quest.xpReward,
        reason: "quest_completed",
        sourceType: "quest",
        sourceId: quest.id,
      });
    }

    const [freshUser] = await tx.select().from(users).where(eq(users.id, appUser.id)).limit(1);

    if (!freshUser) {
      throw new Error("User not found.");
    }

    await tx
      .update(users)
      .set({
        coins: freshUser.coins + totalCoins,
        xp: freshUser.xp + totalXp,
        updatedAt: new Date(),
      })
      .where(eq(users.id, appUser.id));

    await tx
      .update(workoutSessions)
      .set({
        totalCoinsEarned: totalCoins,
        totalXpEarned: totalXp,
      })
      .where(eq(workoutSessions.id, workoutId));
  });

  revalidatePath("/dashboard");
  revalidatePath("/history");
  revalidatePath("/profile");
}
