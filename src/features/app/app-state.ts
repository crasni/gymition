import "server-only";

import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  coinLedgerEntries,
  dailyCheckins,
  exercises,
  lifeHabitCheckins,
  quests,
  rewards,
  users,
  userQuests,
  userRewards,
  userWeeklyGoals,
  workoutEntries,
  workoutSessions,
  xpLedgerEntries,
} from "@/db/schema";
import type {
  Exercise,
  GymitionState,
  LedgerEntry,
  LifeHabitCheckin,
  Quest,
  Reward,
  LeaderboardEntry,
  UserReward,
  WorkoutEntry,
  WorkoutSession,
} from "@/features/economy/types";
import { levelFromXp } from "@/features/economy/xp-rules";
import { calculateLifeStreak, getLifeHabitMap, isLifeDayComplete } from "@/features/life/life-streak";
import { ADMIN_RESOURCE_BALANCE } from "@/features/users/admin";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { localDateKey, localWeekStartKey } from "@/lib/dates";

function toIso(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export async function loadGymitionAppState() {
  const appUser = await requireCurrentAppUser();
  const db = getDb();
  const weekStart = localWeekStartKey();
  const weekStartDate = new Date(`${weekStart}T00:00:00.000`);
  const nextWeekStartDate = new Date(weekStartDate);
  nextWeekStartDate.setDate(nextWeekStartDate.getDate() + 7);

  const [
    exerciseRows,
    rewardRows,
    questRows,
    userRewardRows,
    workoutRows,
    coinLedgerRows,
    xpLedgerRows,
    userQuestRows,
    dailyCheckinRows,
    lifeHabitCheckinRows,
    currentWeeklyGoalRows,
    currentWeekWorkoutRows,
    checkinLeaderboardRows,
    levelLeaderboardRows,
  ] = await Promise.all([
    db.select().from(exercises).where(eq(exercises.isActive, true)),
    db.select().from(rewards).where(eq(rewards.isActive, true)),
    db.select().from(quests).where(and(eq(quests.isActive, true), eq(quests.period, "daily"))),
    db.select().from(userRewards).where(eq(userRewards.userId, appUser.id)),
    db.select().from(workoutSessions).where(eq(workoutSessions.userId, appUser.id)),
    db.select().from(coinLedgerEntries).where(eq(coinLedgerEntries.userId, appUser.id)),
    db.select().from(xpLedgerEntries).where(eq(xpLedgerEntries.userId, appUser.id)),
    db.select().from(userQuests).where(eq(userQuests.userId, appUser.id)),
    db
      .select()
      .from(dailyCheckins)
      .where(eq(dailyCheckins.userId, appUser.id))
      .orderBy(desc(dailyCheckins.checkinDate)),
    db
      .select()
      .from(lifeHabitCheckins)
      .where(eq(lifeHabitCheckins.userId, appUser.id))
      .orderBy(desc(lifeHabitCheckins.checkinDate)),
    db
      .select()
      .from(userWeeklyGoals)
      .where(and(eq(userWeeklyGoals.userId, appUser.id), eq(userWeeklyGoals.weekStart, weekStart)))
      .limit(1),
    db
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, appUser.id),
          eq(workoutSessions.status, "completed"),
          gte(workoutSessions.completedAt, weekStartDate),
          lt(workoutSessions.completedAt, nextWeekStartDate),
        ),
      ),
    db
      .select({
        userId: users.id,
        username: users.username,
        value: users.currentStreak,
      })
      .from(users)
      .where(eq(users.isAdmin, false))
      .orderBy(desc(users.currentStreak), desc(users.lastLoginRewardDate))
      .limit(10),
    db
      .select({
        userId: users.id,
        username: users.username,
        value: users.xp,
      })
      .from(users)
      .where(eq(users.isAdmin, false))
      .orderBy(desc(users.xp))
      .limit(10),
  ]);

  const workoutIds = workoutRows.map((workout) => workout.id);
  const entryRows = workoutIds.length
    ? await db.select().from(workoutEntries).where(inArray(workoutEntries.sessionId, workoutIds))
    : [];

  const entriesBySessionId = new Map<string, WorkoutEntry[]>();
  for (const entry of entryRows) {
    const entries = entriesBySessionId.get(entry.sessionId) ?? [];
    entries.push({
      id: entry.id,
      exerciseId: entry.exerciseId,
      sets: entry.sets ?? undefined,
      reps: entry.reps ?? undefined,
      weight: entry.weight ?? undefined,
      durationSeconds: entry.durationSeconds ?? undefined,
      distanceMeters: entry.distanceMeters ?? undefined,
      notes: entry.notes ?? undefined,
      coinsEarned: entry.coinsEarned,
      xpEarned: entry.xpEarned,
    });
    entriesBySessionId.set(entry.sessionId, entries);
  }

  const exerciseById = new Map(exerciseRows.map((exercise) => [exercise.id, exercise]));
  const currentWeekWorkoutIds = new Set(currentWeekWorkoutRows.map((workout) => workout.id));
  const currentWeekEntries = entryRows.filter((entry) => currentWeekWorkoutIds.has(entry.sessionId));
  const cardioSessionIds = new Set(
    currentWeekEntries
      .filter((entry) => exerciseById.get(entry.exerciseId)?.category === "cardio")
      .map((entry) => entry.sessionId),
  );
  const [currentWeeklyGoal] = currentWeeklyGoalRows;
  const lifeCheckins = lifeHabitCheckinRows.map(
    (checkin): LifeHabitCheckin => ({
      id: checkin.id,
      checkinDate: checkin.checkinDate,
      habitType: checkin.habitType,
      createdAt: checkin.createdAt.toISOString(),
    }),
  );
  const todayLifeHabits = getLifeHabitMap(lifeCheckins).get(localDateKey());

  const state: GymitionState = {
    user: {
      id: appUser.id,
      email: appUser.email,
      username: appUser.username,
      coins: appUser.isAdmin ? ADMIN_RESOURCE_BALANCE : appUser.coins,
      xp: appUser.isAdmin ? ADMIN_RESOURCE_BALANCE : appUser.xp,
      currentStreak: appUser.currentStreak,
      isAdmin: appUser.isAdmin,
      lastLoginRewardDate: appUser.lastLoginRewardDate,
      createdAt: appUser.createdAt.toISOString(),
    },
    coinLedger: coinLedgerRows.map(
      (entry): LedgerEntry => ({
        id: entry.id,
        amount: entry.amount,
        reason: entry.reason,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        createdAt: entry.createdAt.toISOString(),
      }),
    ),
    xpLedger: xpLedgerRows.map(
      (entry): LedgerEntry => ({
        id: entry.id,
        amount: entry.amount,
        reason: entry.reason,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        createdAt: entry.createdAt.toISOString(),
      }),
    ),
    workouts: workoutRows.map(
      (workout): WorkoutSession => ({
        id: workout.id,
        status: workout.status,
        mode: workout.mode,
        startedAt: workout.startedAt.toISOString(),
        completedAt: toIso(workout.completedAt),
        durationSeconds: workout.durationSeconds ?? undefined,
        notes: workout.notes ?? undefined,
        entries: entriesBySessionId.get(workout.id) ?? [],
        totalCoinsEarned: workout.totalCoinsEarned,
        totalXpEarned: workout.totalXpEarned,
      }),
    ),
    userRewards: userRewardRows.map(
      (reward): UserReward => ({
        rewardId: reward.rewardId,
        purchasedAt: reward.purchasedAt.toISOString(),
        equippedAt: toIso(reward.equippedAt),
      }),
    ),
    questRewards: Object.fromEntries(
      userQuestRows
        .filter((quest) => quest.claimedAt)
        .map((quest) => [`${quest.periodStart}:${quest.questId}`, quest.claimedAt?.toISOString() ?? ""]),
    ),
    dailyCheckins: dailyCheckinRows.map((checkin) => ({
      id: checkin.id,
      checkinDate: checkin.checkinDate,
      streakDay: checkin.streakDay,
      coinsEarned: checkin.coinsEarned,
      xpEarned: checkin.xpEarned,
      streakBonusCoins: checkin.streakBonusCoins,
      createdAt: checkin.createdAt.toISOString(),
    })),
    lifeHabitCheckins: lifeCheckins,
    lifeSummary: {
      streak: calculateLifeStreak(lifeCheckins),
      todayCompleted: isLifeDayComplete(todayLifeHabits),
      todayCompletedCount: todayLifeHabits?.size ?? 0,
    },
    weeklyGoal: currentWeeklyGoal
      ? {
          id: currentWeeklyGoal.id,
          weekStart: currentWeeklyGoal.weekStart,
          workoutTarget: currentWeeklyGoal.workoutTarget,
          cardioTarget: currentWeeklyGoal.cardioTarget,
        }
      : null,
    weeklyGoalProgress: {
      workoutsCompleted: currentWeekWorkoutRows.length,
      cardioWorkoutsCompleted: cardioSessionIds.size,
    },
    leaderboard: {
      checkinStreaks: checkinLeaderboardRows.map(toLeaderboardEntry),
      levels: levelLeaderboardRows.map((entry) => ({
        userId: entry.userId,
        username: entry.username,
        value: levelFromXp(entry.value),
      })),
    },
  };

  return {
    state,
    exercises: exerciseRows.map(
      (exercise): Exercise => ({
        id: exercise.id,
        name: exercise.name,
        category: exercise.category,
        measurementType: exercise.measurementType,
        defaultCoinValue: exercise.defaultCoinValue,
        isActive: exercise.isActive,
      }),
    ),
    rewards: rewardRows.map(
      (reward): Reward => ({
        id: reward.id,
        name: reward.name,
        description: reward.description,
        cost: reward.cost,
        type: reward.type,
        metadata: reward.metadata,
        isActive: reward.isActive,
      }),
    ),
    quests: questRows.map(
      (quest): Quest => ({
        id: quest.id,
        code: quest.code,
        name: quest.name,
        description: quest.description,
        period: quest.period,
        targetType: quest.targetType,
        targetValue: quest.targetValue,
        category: quest.category ?? undefined,
        coinReward: quest.coinReward,
        xpReward: quest.xpReward,
        isActive: quest.isActive,
      }),
    ),
  };
}

function toLeaderboardEntry(entry: { userId: string; username: string; value: number }): LeaderboardEntry {
  return {
    userId: entry.userId,
    username: entry.username,
    value: entry.value,
  };
}
