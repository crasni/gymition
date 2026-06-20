import { loadGymitionAppState } from "@/features/app/app-state";
import { claimDailyRewardAction } from "@/features/economy/daily-reward-actions";
import { setWeeklyGoalAction } from "@/features/goals/goal-actions";
import { updateProfileAction } from "@/features/profile/profile-actions";
import { GymitionPrototype } from "@/features/prototype/GymitionPrototype";
import { purchaseRewardAction } from "@/features/rewards/reward-actions";
import { completeWorkoutAction } from "@/features/workouts/workout-actions";

type AppView = "dashboard" | "workout" | "history" | "rewards" | "profile";

export async function GymitionApp({ view }: { view: AppView }) {
  const { state, exercises, quests, rewards } = await loadGymitionAppState();

  return (
    <GymitionPrototype
      initialView={view}
      initialState={state}
      exercises={exercises}
      quests={quests}
      rewards={rewards}
      actions={{
        claimDailyReward: claimDailyRewardAction,
        completeWorkout: completeWorkoutAction,
        purchaseReward: purchaseRewardAction,
        updateProfile: updateProfileAction,
        setWeeklyGoal: setWeeklyGoalAction,
      }}
    />
  );
}
