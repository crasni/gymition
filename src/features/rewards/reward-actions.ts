"use server";

import { and, eq } from "drizzle-orm";
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

    const [ownedReward] = await tx
      .select()
      .from(userRewards)
      .where(and(eq(userRewards.userId, appUser.id), eq(userRewards.rewardId, reward.id)))
      .limit(1);

    if (ownedReward) {
      throw new Error("Reward already owned.");
    }

    const [freshUser] = await tx.select().from(users).where(eq(users.id, appUser.id)).limit(1);

    if (!freshUser || freshUser.coins < reward.cost) {
      throw new Error("Not enough coins.");
    }

    await tx
      .update(users)
      .set({
        coins: freshUser.coins - reward.cost,
        updatedAt: new Date(),
      })
      .where(eq(users.id, appUser.id));

    await tx.insert(userRewards).values({
      userId: appUser.id,
      rewardId: reward.id,
      equippedAt: reward.type === "title" ? new Date() : null,
    });

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
