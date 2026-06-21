import { notFound } from "next/navigation";
import { GymitionPrototype } from "@/features/prototype/GymitionPrototype";
import type { GymitionState, UserReward, WorkoutSession } from "@/features/economy/types";
import { localDateKey } from "@/lib/dates";

type E2EView = "dashboard" | "workout" | "history" | "rewards" | "life" | "leaderboard" | "profile";

const views = new Set<E2EView>(["dashboard", "workout", "history", "rewards", "life", "leaderboard", "profile"]);

export const dynamic = "force-dynamic";

export default async function E2EPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; rich?: string }>;
}) {
  if (process.env.E2E_TEST_MODE !== "1") {
    notFound();
  }

  const params = await searchParams;
  const view = views.has(params.view as E2EView) ? (params.view as E2EView) : "dashboard";

  return <GymitionPrototype initialView={view} initialState={createE2EState(params.rich === "1")} />;
}

function createE2EState(rich: boolean): GymitionState {
  const now = new Date().toISOString();
  const today = localDateKey();
  const userRewards: UserReward[] = rich
    ? [
        {
          rewardId: "title_first_rep",
          purchasedAt: now,
          equippedAt: null,
        },
        {
          rewardId: "frame_warm_standard",
          purchasedAt: now,
          equippedAt: null,
        },
      ]
    : [];
  const workouts: WorkoutSession[] = rich
    ? [
        {
          id: "e2e_workout_1",
          status: "completed",
          mode: "simple",
          startedAt: now,
          completedAt: now,
          durationSeconds: 2700,
          notes: "E2E session",
          entries: [],
          totalCoinsEarned: 35,
          totalXpEarned: 45,
        },
      ]
    : [];

  return {
    user: {
      id: "e2e_user",
      email: "e2e@gymition.local",
      username: "E2E User",
      coins: rich ? 1000 : 0,
      xp: rich ? 420 : 0,
      currentStreak: rich ? 4 : 0,
      role: "user",
      lastLoginRewardDate: null,
      createdAt: now,
    },
    coinLedger: rich
      ? [
          {
            id: "e2e_coin_1",
            amount: 35,
            reason: "workout_completed",
            sourceType: "workout",
            sourceId: "e2e_workout_1",
            createdAt: now,
          },
        ]
      : [],
    xpLedger: [],
    workouts,
    userRewards,
    questRewards: {},
    dailyCheckins: [],
    lifeHabitCheckins: [],
    lifeSummary: {
      streak: 0,
      todayCompleted: false,
      todayCompletedCount: 0,
    },
    weeklyGoal: rich
      ? {
          id: "e2e_weekly_goal",
          weekStart: today,
          workoutTarget: 3,
          cardioTarget: 1,
        }
      : null,
    weeklyGoalProgress: {
      workoutsCompleted: workouts.length,
      cardioWorkoutsCompleted: 0,
    },
    leaderboard: {
      checkinStreaks: [
        {
          userId: "e2e_friend",
          username: "Steady Friend",
          value: 9,
        },
      ],
      levels: [
        {
          userId: "e2e_friend",
          username: "Steady Friend",
          value: 4,
        },
      ],
    },
  };
}
