"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { coinLedgerEntries, dailyCheckins, users, xpLedgerEntries } from "@/db/schema";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { localDateKey } from "@/lib/dates";
import { createId } from "@/lib/ids";
import { calculateStreakBonus, REWARD_RULES } from "./reward-rules";
import { nextLoginStreak } from "@/features/streaks/streak-service";

export async function claimDailyRewardAction() {
  const appUser = await requireCurrentAppUser();
  const db = getDb();
  const today = localDateKey();

  const result = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select().from(users).where(eq(users.id, appUser.id)).limit(1);

    if (!freshUser) {
      throw new Error("User not found.");
    }

    if (freshUser.lastLoginRewardDate === today) {
      const [existingCheckin] = await tx
        .select()
        .from(dailyCheckins)
        .where(and(eq(dailyCheckins.userId, appUser.id), eq(dailyCheckins.checkinDate, today)))
        .limit(1);

      return {
        coins: (existingCheckin?.coinsEarned ?? REWARD_RULES.dailyLogin.coins) + (existingCheckin?.streakBonusCoins ?? 0),
        xp: existingCheckin?.xpEarned ?? REWARD_RULES.dailyLogin.xp,
        streak: freshUser.currentStreak,
        streakBonus: existingCheckin?.streakBonusCoins ?? 0,
      };
    }

    const nextStreak = nextLoginStreak(freshUser.lastLoginRewardDate, freshUser.currentStreak);
    const streakBonus = calculateStreakBonus(nextStreak);
    const totalCoins = REWARD_RULES.dailyLogin.coins + streakBonus;
    const now = new Date();

    const [insertedCheckin] = await tx
      .insert(dailyCheckins)
      .values({
        id: createId("checkin"),
        userId: appUser.id,
        checkinDate: today,
        streakDay: nextStreak,
        coinsEarned: REWARD_RULES.dailyLogin.coins,
        xpEarned: REWARD_RULES.dailyLogin.xp,
        streakBonusCoins: streakBonus,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [dailyCheckins.userId, dailyCheckins.checkinDate],
      })
      .returning();

    if (!insertedCheckin) {
      const [[existingCheckin], [currentUser]] = await Promise.all([
        tx
          .select()
          .from(dailyCheckins)
          .where(and(eq(dailyCheckins.userId, appUser.id), eq(dailyCheckins.checkinDate, today)))
          .limit(1),
        tx.select().from(users).where(eq(users.id, appUser.id)).limit(1),
      ]);

      return {
        coins: (existingCheckin?.coinsEarned ?? REWARD_RULES.dailyLogin.coins) + (existingCheckin?.streakBonusCoins ?? 0),
        xp: existingCheckin?.xpEarned ?? REWARD_RULES.dailyLogin.xp,
        streak: currentUser?.currentStreak ?? freshUser.currentStreak,
        streakBonus: existingCheckin?.streakBonusCoins ?? 0,
      };
    }

    await tx
      .update(users)
      .set({
        coins: sql`${users.coins} + ${totalCoins}`,
        xp: sql`${users.xp} + ${REWARD_RULES.dailyLogin.xp}`,
        currentStreak: nextStreak,
        lastLoginRewardDate: today,
        updatedAt: now,
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

    return {
      coins: totalCoins,
      xp: REWARD_RULES.dailyLogin.xp,
      streak: nextStreak,
      streakBonus,
    };
  });

  revalidatePath("/dashboard");
  return result;
}
