"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { lifeHabitCheckins } from "@/db/schema";
import type { LifeCheckinSummary } from "@/features/economy/types";
import {
  calculateLifeStreak,
  getLifeHabitMap,
  isLifeDayComplete,
  isLifeHabitType,
} from "@/features/life/life-streak";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";

export async function checkinLifeHabitAction(input: { habitType: string }) {
  if (!isLifeHabitType(input.habitType)) {
    throw new Error("Invalid life habit.");
  }

  const habitType = input.habitType;
  const appUser = await requireCurrentAppUser();
  const db = getDb();
  const today = localDateKey();

  const result = await db.transaction(async (tx): Promise<LifeCheckinSummary> => {
    const [existingCheckin] = await tx
      .select()
      .from(lifeHabitCheckins)
      .where(
        and(
          eq(lifeHabitCheckins.userId, appUser.id),
          eq(lifeHabitCheckins.checkinDate, today),
          eq(lifeHabitCheckins.habitType, habitType),
        ),
      )
      .limit(1);

    if (!existingCheckin) {
      await tx.insert(lifeHabitCheckins).values({
        id: createId("life_checkin"),
        userId: appUser.id,
        checkinDate: today,
        habitType,
      });
    }

    const checkins = await tx
      .select()
      .from(lifeHabitCheckins)
      .where(eq(lifeHabitCheckins.userId, appUser.id))
      .orderBy(desc(lifeHabitCheckins.checkinDate));
    const habitsByDate = getLifeHabitMap(checkins);
    const todayHabits = habitsByDate.get(today);

    return {
      habitType,
      alreadyCompleted: Boolean(existingCheckin),
      todayCompleted: isLifeDayComplete(todayHabits),
      todayCompletedCount: todayHabits?.size ?? 0,
      streak: calculateLifeStreak(checkins),
    };
  });

  revalidatePath("/life");
  revalidatePath("/dashboard");
  return result;
}
