import { localDateKey } from "@/lib/dates";
import type { Exercise, GymitionState, Quest, QuestProgress } from "@/features/economy/types";

export function getDailyQuestKey(questId: string, dateKey = localDateKey()) {
  return `${dateKey}:${questId}`;
}

export function calculateQuestProgress(
  state: GymitionState,
  quests: Quest[],
  exercises: Exercise[],
  dateKey = localDateKey(),
): QuestProgress[] {
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const todaysWorkouts = state.workouts.filter(
    (workout) =>
      workout.status === "completed" &&
      workout.completedAt?.startsWith(dateKey),
  );

  return quests.map((quest) => {
    let progress = 0;

    if (quest.targetType === "workout_completed") {
      progress = todaysWorkouts.length;
    }

    if (quest.targetType === "exercise_count") {
      progress = todaysWorkouts.reduce((total, workout) => total + workout.entries.length, 0);
    }

    if (quest.targetType === "category_logged") {
      progress = todaysWorkouts.reduce((total, workout) => {
        return (
          total +
          workout.entries.filter((entry) => exerciseById.get(entry.exerciseId)?.category === quest.category)
            .length
        );
      }, 0);
    }

    if (quest.targetType === "duration_seconds") {
      progress = todaysWorkouts.reduce((total, workout) => {
        return (
          total +
          workout.entries.reduce((entryTotal, entry) => {
            const exercise = exerciseById.get(entry.exerciseId);
            if (exercise?.category !== quest.category) {
              return entryTotal;
            }
            return entryTotal + (entry.durationSeconds ?? 0);
          }, 0)
        );
      }, 0);
    }

    const completed = progress >= quest.targetValue;
    return {
      questId: quest.id,
      progress,
      completed,
      rewarded: Boolean(state.questRewards[getDailyQuestKey(quest.id, dateKey)]),
    };
  });
}
