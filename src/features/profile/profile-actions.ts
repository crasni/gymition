"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import {
  coinLedgerEntries,
  dailyCheckins,
  lifeHabitCheckins,
  userQuests,
  userRewards,
  users,
  userWeeklyGoals,
  workoutSessions,
  xpLedgerEntries,
} from "@/db/schema";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { hasTestResources, TEST_RESOURCE_BALANCE } from "@/features/users/roles";
import { updateProfileSchema } from "./profile-validation";

export async function updateProfileAction(input: unknown) {
  const parsed = updateProfileSchema.parse(input);
  const appUser = await requireCurrentAppUser();
  const db = getDb();

  await db
    .update(users)
    .set({
      username: parsed.username,
      updatedAt: new Date(),
    })
    .where(eq(users.id, appUser.id));

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function resetProfileDataAction() {
  const appUser = await requireCurrentAppUser();
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.delete(dailyCheckins).where(eq(dailyCheckins.userId, appUser.id));
    await tx.delete(lifeHabitCheckins).where(eq(lifeHabitCheckins.userId, appUser.id));
    await tx.delete(userQuests).where(eq(userQuests.userId, appUser.id));
    await tx.delete(userRewards).where(eq(userRewards.userId, appUser.id));
    await tx.delete(userWeeklyGoals).where(eq(userWeeklyGoals.userId, appUser.id));
    await tx.delete(coinLedgerEntries).where(eq(coinLedgerEntries.userId, appUser.id));
    await tx.delete(xpLedgerEntries).where(eq(xpLedgerEntries.userId, appUser.id));
    await tx.delete(workoutSessions).where(eq(workoutSessions.userId, appUser.id));

    await tx
      .update(users)
      .set({
        coins: hasTestResources(appUser.role) ? TEST_RESOURCE_BALANCE : 0,
        xp: hasTestResources(appUser.role) ? TEST_RESOURCE_BALANCE : 0,
        currentStreak: 0,
        lastLoginRewardDate: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, appUser.id));
  });

  revalidatePath("/dashboard");
  revalidatePath("/workout");
  revalidatePath("/history");
  revalidatePath("/rewards");
  revalidatePath("/life");
  revalidatePath("/profile");
}
