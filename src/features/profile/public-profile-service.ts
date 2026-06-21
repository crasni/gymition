import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rewards, users, userRewards } from "@/db/schema";
import type { Reward } from "@/features/economy/types";
import { levelFromXp } from "@/features/economy/xp-rules";

export type PublicProfile = {
  user: {
    id: string;
    username: string;
    level: number;
    currentStreak: number;
  };
  equippedTitle?: Reward;
  equippedFrame?: Reward;
  badges: Reward[];
};

export async function loadPublicProfile(userId: string): Promise<PublicProfile | null> {
  const db = getDb();

  const [profileRows, rewardRows, ownedRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        xp: users.xp,
        currentStreak: users.currentStreak,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, "user")))
      .limit(1),
    db.select().from(rewards).where(eq(rewards.isActive, true)),
    db.select().from(userRewards).where(eq(userRewards.userId, userId)),
  ]);

  const [profile] = profileRows;
  if (!profile) {
    return null;
  }

  const rewardById = new Map(rewardRows.map((reward) => [reward.id, toReward(reward)]));
  const ownedRewardIds = new Set(ownedRows.map((reward) => reward.rewardId));
  const equippedRewardIds = new Set(ownedRows.filter((reward) => reward.equippedAt).map((reward) => reward.rewardId));
  const ownedRewards = [...ownedRewardIds]
    .map((rewardId) => rewardById.get(rewardId))
    .filter((reward): reward is Reward => Boolean(reward));

  return {
    user: {
      id: profile.id,
      username: profile.username,
      level: levelFromXp(profile.xp),
      currentStreak: profile.currentStreak,
    },
    equippedTitle: ownedRewards.find((reward) => reward.type === "title" && equippedRewardIds.has(reward.id)),
    equippedFrame: ownedRewards.find((reward) => reward.type === "frame" && equippedRewardIds.has(reward.id)),
    badges: ownedRewards.filter((reward) => reward.type === "badge"),
  };
}

function toReward(reward: typeof rewards.$inferSelect): Reward {
  return {
    id: reward.id,
    name: reward.name,
    description: reward.description,
    cost: reward.cost,
    type: reward.type,
    metadata: reward.metadata,
    isActive: reward.isActive,
  };
}
