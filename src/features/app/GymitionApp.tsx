import { loadGymitionAppState } from "@/features/app/app-state";
import { claimDailyRewardAction } from "@/features/economy/daily-reward-actions";
import { setWeeklyGoalAction } from "@/features/goals/goal-actions";
import { checkinLifeHabitAction } from "@/features/life/life-actions";
import { resetProfileDataAction, updateProfileAction } from "@/features/profile/profile-actions";
import { GymitionPrototype } from "@/features/prototype/GymitionPrototype";
import { equipRewardAction, purchaseRewardAction, unequipRewardAction } from "@/features/rewards/reward-actions";
import { completeWorkoutAction } from "@/features/workouts/workout-actions";

type AppView = "dashboard" | "workout" | "history" | "rewards" | "life" | "leaderboard" | "profile";

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
        equipReward: equipRewardAction,
        unequipReward: unequipRewardAction,
        updateProfile: updateProfileAction,
        resetProfileData: resetProfileDataAction,
        setWeeklyGoal: setWeeklyGoalAction,
        checkinLifeHabit: checkinLifeHabitAction,
      }}
    />
  );
}
