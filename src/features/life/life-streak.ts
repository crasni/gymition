import type { LifeHabitCheckin, LifeHabitType } from "@/features/economy/types";
import { localDateKey } from "@/lib/dates";

export const lifeHabitTypes = ["face_wash", "tooth_brush"] as const satisfies LifeHabitType[];

export function isLifeHabitType(value: string): value is LifeHabitType {
  return lifeHabitTypes.includes(value as LifeHabitType);
}

export function getLifeHabitMap(checkins: Pick<LifeHabitCheckin, "checkinDate" | "habitType">[]) {
  const habitsByDate = new Map<string, Set<LifeHabitType>>();

  for (const checkin of checkins) {
    const habits = habitsByDate.get(checkin.checkinDate) ?? new Set<LifeHabitType>();
    habits.add(checkin.habitType);
    habitsByDate.set(checkin.checkinDate, habits);
  }

  return habitsByDate;
}

export function isLifeDayComplete(habits?: Set<LifeHabitType>) {
  return lifeHabitTypes.every((habitType) => habits?.has(habitType));
}

export function calculateLifeStreak(
  checkins: Pick<LifeHabitCheckin, "checkinDate" | "habitType">[],
  today = localDateKey(),
) {
  const habitsByDate = getLifeHabitMap(checkins);
  const todayComplete = isLifeDayComplete(habitsByDate.get(today));
  let cursor = todayComplete ? today : addDays(today, -1);
  let streak = 0;

  while (isLifeDayComplete(habitsByDate.get(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}
