"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, type DbClient } from "@/db/client";
import {
  coinLedgerEntries,
  lifeHabitCheckins,
  rewards,
  userRewards,
  users,
  workoutSessions,
} from "@/db/schema";
import { levelFromXp } from "@/features/economy/xp-rules";
import {
  calculateLifetimeCoins,
  cosmeticSource,
  isAchievementUnlocked,
  isEquippableCosmetic,
  isLevelUnlocked,
  requiredLevel,
  type CosmeticContext,
} from "@/features/rewards/cosmetic-rules";
import { calculateLifeStreak } from "@/features/life/life-streak";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { canBypassCosmeticLocks } from "@/features/users/roles";
import { createId } from "@/lib/ids";
import { equipRewardSchema, purchaseRewardSchema, unequipRewardSchema } from "./reward-validation";

export async function purchaseRewardAction(input: unknown) {
  const parsed = purchaseRewardSchema.parse(input);
  const appUser = await requireCurrentAppUser();
  const db = getDb();

  await db.transaction(async (tx) => {
    const [reward] = await tx
      .select()
      .from(rewards)
      .where(and(eq(rewards.id, parsed.rewardId), eq(rewards.isActive, true)))
      .limit(1);

    if (!reward) {
      throw new Error("Reward not found.");
    }

    if (cosmeticSource(reward) !== "shop") {
      throw new Error("This item is unlocked through an achievement.");
    }

    const [freshUser] = await tx.select().from(users).where(eq(users.id, appUser.id)).limit(1);
    if (!freshUser) {
      throw new Error("User not found.");
    }

    const purchaseContext: CosmeticContext = {
      checkinStreak: freshUser.currentStreak,
      lifeStreak: 0,
      level: levelFromXp(freshUser.xp),
      completedWorkouts: 0,
      currentCoins: freshUser.coins,
      lifetimeCoins: 0,
      canBypassLocks: canBypassCosmeticLocks(freshUser.role),
    };

    if (!canBypassCosmeticLocks(freshUser.role) && !isLevelUnlocked(reward, purchaseContext)) {
      throw new Error(`Reach level ${requiredLevel(reward)} to unlock this item.`);
    }

    const [insertedReward] = await tx
      .insert(userRewards)
      .values({
        userId: appUser.id,
        rewardId: reward.id,
        equippedAt: null,
      })
      .onConflictDoNothing({
        target: [userRewards.userId, userRewards.rewardId],
      })
      .returning({ rewardId: userRewards.rewardId });

    if (!insertedReward) {
      throw new Error("Reward already owned.");
    }

    if (!canBypassCosmeticLocks(freshUser.role)) {
      const [updatedUser] = await tx
        .update(users)
        .set({
          coins: sql`${users.coins} - ${reward.cost}`,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, appUser.id), gte(users.coins, reward.cost)))
        .returning({ id: users.id });

      if (!updatedUser) {
        throw new Error("Not enough coins.");
      }
    }

    if (reward.cost > 0 && !canBypassCosmeticLocks(freshUser.role)) {
      await tx.insert(coinLedgerEntries).values({
        id: createId("coin_ledger"),
        userId: appUser.id,
        amount: -reward.cost,
        reason: "reward_purchase",
        sourceType: "reward",
        sourceId: reward.id,
      });
    }
  });

  revalidatePath("/rewards");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function unequipRewardAction(input: unknown) {
  const parsed = unequipRewardSchema.parse(input);
  const appUser = await requireCurrentAppUser();
  const db = getDb();

  await db.transaction(async (tx) => {
    const sameTypeRewards = await tx.select({ id: rewards.id }).from(rewards).where(eq(rewards.type, parsed.type));

    for (const reward of sameTypeRewards) {
      await tx
        .update(userRewards)
        .set({ equippedAt: null })
        .where(and(eq(userRewards.userId, appUser.id), eq(userRewards.rewardId, reward.id)));
    }
  });

  revalidatePath("/rewards");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function equipRewardAction(input: unknown) {
  const parsed = equipRewardSchema.parse(input);
  const appUser = await requireCurrentAppUser();
  const db = getDb();

  await db.transaction(async (tx) => {
    const [reward] = await tx
      .select()
      .from(rewards)
      .where(and(eq(rewards.id, parsed.rewardId), eq(rewards.isActive, true)))
      .limit(1);

    if (!reward) {
      throw new Error("Item not found.");
    }

    if (!isEquippableCosmetic(reward)) {
      throw new Error("Badges are collectibles and cannot be equipped.");
    }

    const [ownedReward] = await tx
      .select()
      .from(userRewards)
      .where(and(eq(userRewards.userId, appUser.id), eq(userRewards.rewardId, reward.id)))
      .limit(1);

    if (!ownedReward) {
      const context = await buildServerCosmeticContext(tx, appUser.id);

      if (!isAchievementUnlocked(reward, context)) {
        throw new Error("This item is not unlocked yet.");
      }

      await tx.insert(userRewards).values({
        userId: appUser.id,
        rewardId: reward.id,
        equippedAt: null,
      });
    }

    const sameTypeRewards = await tx.select({ id: rewards.id }).from(rewards).where(eq(rewards.type, reward.type));
    const sameTypeRewardIds = sameTypeRewards.map((item) => item.id);
    const now = new Date();

    for (const rewardId of sameTypeRewardIds) {
      await tx
        .update(userRewards)
        .set({ equippedAt: null })
        .where(and(eq(userRewards.userId, appUser.id), eq(userRewards.rewardId, rewardId)));
    }

    await tx
      .update(userRewards)
      .set({ equippedAt: now })
      .where(and(eq(userRewards.userId, appUser.id), eq(userRewards.rewardId, reward.id)));
  });

  revalidatePath("/rewards");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

async function buildServerCosmeticContext(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  userId: string,
): Promise<CosmeticContext> {
  const [[freshUser], workoutRows, coinRows, lifeCheckins] = await Promise.all([
    tx.select().from(users).where(eq(users.id, userId)).limit(1),
    tx.select().from(workoutSessions).where(and(eq(workoutSessions.userId, userId), eq(workoutSessions.status, "completed"))),
    tx.select().from(coinLedgerEntries).where(eq(coinLedgerEntries.userId, userId)),
    tx.select().from(lifeHabitCheckins).where(eq(lifeHabitCheckins.userId, userId)),
  ]);

  if (!freshUser) {
    throw new Error("User not found.");
  }

  return {
    checkinStreak: freshUser.currentStreak,
    lifeStreak: calculateLifeStreak(lifeCheckins),
    level: levelFromXp(freshUser.xp),
    completedWorkouts: workoutRows.length,
    currentCoins: freshUser.coins,
    lifetimeCoins: calculateLifetimeCoins(
      coinRows.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        reason: entry.reason,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        createdAt: entry.createdAt.toISOString(),
      })),
    ),
    canBypassLocks: canBypassCosmeticLocks(freshUser.role),
  };
}
