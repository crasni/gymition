"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { userWeeklyGoals } from "@/db/schema";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { localWeekStartKey } from "@/lib/dates";
import { createId } from "@/lib/ids";
import { setWeeklyGoalSchema } from "./goal-validation";

export async function setWeeklyGoalAction(input: unknown) {
  const parsed = setWeeklyGoalSchema.parse(input);
  const appUser = await requireCurrentAppUser();
  const db = getDb();
  const weekStart = localWeekStartKey();
  const now = new Date();

  await db
    .insert(userWeeklyGoals)
    .values({
      id: createId("weekly_goal"),
      userId: appUser.id,
      weekStart,
      workoutTarget: parsed.workoutTarget,
      cardioTarget: parsed.cardioTarget,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userWeeklyGoals.userId, userWeeklyGoals.weekStart],
      set: {
        workoutTarget: parsed.workoutTarget,
        cardioTarget: parsed.cardioTarget,
        updatedAt: now,
      },
    });

  revalidatePath("/dashboard");
  revalidatePath("/profile");
}
