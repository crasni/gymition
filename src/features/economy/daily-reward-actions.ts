"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { coinLedgerEntries, users, xpLedgerEntries } from "@/db/schema";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";
import { calculateStreakBonus, REWARD_RULES } from "./reward-rules";
import { nextLoginStreak } from "@/features/streaks/streak-service";

export async function claimDailyRewardAction() {
  const appUser = await requireCurrentAppUser();
  const db = getDb();
  const today = localDateKey();

  await db.transaction(async (tx) => {
    const [freshUser] = await tx.select().from(users).where(eq(users.id, appUser.id)).limit(1);

    if (!freshUser) {
      throw new Error("User not found.");
    }

    if (freshUser.lastLoginRewardDate === today) {
      throw new Error("Daily reward already claimed.");
    }

    const nextStreak = nextLoginStreak(freshUser.lastLoginRewardDate, freshUser.currentStreak);
    const streakBonus = calculateStreakBonus(nextStreak);
    const totalCoins = REWARD_RULES.dailyLogin.coins + streakBonus;

    await tx
      .update(users)
      .set({
        coins: freshUser.coins + totalCoins,
        xp: freshUser.xp + REWARD_RULES.dailyLogin.xp,
        currentStreak: nextStreak,
        lastLoginRewardDate: today,
        updatedAt: new Date(),
      })
      .where(eq(users.id, appUser.id));

    await tx.insert(coinLedgerEntries).values([
      {
        id: createId("coin_ledger"),
        userId: appUser.id,
        amount: REWARD_RULES.dailyLogin.coins,
        reason: "daily_login",
        sourceType: "login",
        sourceId: today,
      },
      {
        id: createId("coin_ledger"),
        userId: appUser.id,
        amount: streakBonus,
        reason: "streak_bonus",
        sourceType: "login",
        sourceId: today,
      },
    ]);

    await tx.insert(xpLedgerEntries).values({
      id: createId("xp_ledger"),
      userId: appUser.id,
      amount: REWARD_RULES.dailyLogin.xp,
      reason: "daily_login",
      sourceType: "login",
      sourceId: today,
    });
  });

  revalidatePath("/dashboard");
}
