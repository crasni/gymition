import type { WorkoutSession } from "@/features/economy/types";

export function summarizeWorkout(workout: WorkoutSession) {
  return {
    entries: workout.entries.length,
    coins: workout.totalCoinsEarned,
    xp: workout.totalXpEarned,
  };
}
