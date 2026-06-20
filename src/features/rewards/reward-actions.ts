"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { coinLedgerEntries, rewards, userRewards, users } from "@/db/schema";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { createId } from "@/lib/ids";
import { purchaseRewardSchema } from "./reward-validation";

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

    const [insertedReward] = await tx
      .insert(userRewards)
      .values({
        userId: appUser.id,
        rewardId: reward.id,
        equippedAt: reward.type === "title" ? new Date() : null,
      })
      .onConflictDoNothing({
        target: [userRewards.userId, userRewards.rewardId],
      })
      .returning({ rewardId: userRewards.rewardId });

    if (!insertedReward) {
      throw new Error("Reward already owned.");
    }

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

    await tx.insert(coinLedgerEntries).values({
      id: createId("coin_ledger"),
      userId: appUser.id,
      amount: -reward.cost,
      reason: "reward_purchase",
      sourceType: "reward",
      sourceId: reward.id,
    });
  });

  revalidatePath("/rewards");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}
