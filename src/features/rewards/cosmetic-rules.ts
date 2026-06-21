import type { GymitionState, Reward, UserReward } from "@/features/economy/types";
import { levelFromXp } from "@/features/economy/xp-rules";

export type CosmeticSource = "shop" | "achievement" | "system";
export type CosmeticRarity = "common" | "rare" | "epic" | "legendary";
export type CosmeticFilter = "all" | "title" | "badge" | "frame" | "owned";

export type CosmeticContext = {
  checkinStreak: number;
  lifeStreak: number;
  level: number;
  completedWorkouts: number;
  currentCoins: number;
  lifetimeCoins: number;
  canBypassLocks: boolean;
};

export function buildCosmeticContext(state: GymitionState): CosmeticContext {
  return {
    checkinStreak: state.user.currentStreak,
    lifeStreak: state.lifeSummary.streak,
    level: levelFromXp(state.user.xp),
    completedWorkouts: state.workouts.filter((workout) => workout.status === "completed").length,
    currentCoins: state.user.coins,
    lifetimeCoins: calculateLifetimeCoins(state.coinLedger),
    canBypassLocks: state.user.role === "tester",
  };
}

export function calculateLifetimeCoins(ledger: GymitionState["coinLedger"]) {
  return ledger.reduce((total, entry) => total + Math.max(entry.amount, 0), 0);
}

export function cosmeticSource(reward: Reward): CosmeticSource {
  const source = reward.metadata.source;
  if (source === "achievement" || source === "system") {
    return source;
  }
  return "shop";
}

export function cosmeticRarity(reward: Reward): CosmeticRarity {
  const rarity = reward.metadata.rarity;
  if (rarity === "rare" || rarity === "epic" || rarity === "legendary") {
    return rarity;
  }
  return "common";
}

export function requiredLevel(reward: Reward) {
  return parsePositiveInteger(reward.metadata.requiredLevel);
}

export function cosmeticAccent(reward: Reward) {
  return reward.metadata.accent || "#c8832b";
}

export function isCosmeticType(reward: Reward) {
  return reward.type === "title" || reward.type === "badge" || reward.type === "frame";
}

export function isEquippableCosmetic(reward: Reward) {
  return reward.type === "title" || reward.type === "frame";
}

export function isAchievementUnlocked(reward: Reward, context: CosmeticContext) {
  if (context.canBypassLocks) {
    return true;
  }

  if (cosmeticSource(reward) !== "achievement") {
    return false;
  }

  const rule = reward.metadata.unlockRule;
  if (!rule) {
    return true;
  }

  const [kind, rawThreshold] = rule.split(":");
  const threshold = parsePositiveInteger(rawThreshold) ?? 0;

  if (kind === "streak") return context.checkinStreak >= threshold;
  if (kind === "life") return context.lifeStreak >= threshold;
  if (kind === "level") return context.level >= threshold;
  if (kind === "workouts") return context.completedWorkouts >= threshold;
  if (kind === "coins") return context.lifetimeCoins >= threshold;

  return false;
}

export function isLevelUnlocked(reward: Reward, context: CosmeticContext) {
  const levelRequirement = requiredLevel(reward);
  return context.canBypassLocks || !levelRequirement || context.level >= levelRequirement;
}

export function unlockRequirementLabel(reward: Reward) {
  const rule = reward.metadata.unlockRule;
  if (!rule) {
    const levelRequirement = requiredLevel(reward);
    return levelRequirement ? `Reach level ${levelRequirement}` : "Available";
  }

  const [kind, rawThreshold] = rule.split(":");
  const threshold = parsePositiveInteger(rawThreshold) ?? 0;

  if (kind === "streak") return `Reach a ${threshold}-day check-in streak`;
  if (kind === "life") return `Reach a ${threshold}-day Life streak`;
  if (kind === "level") return `Reach level ${threshold}`;
  if (kind === "workouts") return `Complete ${threshold} workouts`;
  if (kind === "coins") return `Earn ${threshold} total coins`;

  return "Complete the achievement";
}

export function getOwnedCosmeticIds(
  rewards: Reward[],
  userRewards: UserReward[],
  context: CosmeticContext,
) {
  const ownedIds = new Set(userRewards.map((reward) => reward.rewardId));

  for (const reward of rewards) {
    if (isAchievementUnlocked(reward, context)) {
      ownedIds.add(reward.id);
    }
  }

  return ownedIds;
}

export function getEquippedCosmetic(
  rewards: Reward[],
  userRewards: UserReward[],
  type: "title" | "frame",
) {
  const equippedIds = new Set(
    userRewards.filter((reward) => reward.equippedAt).map((reward) => reward.rewardId),
  );
  return rewards.find((reward) => reward.type === type && equippedIds.has(reward.id));
}

export function equipCosmeticInState(
  userRewards: UserReward[],
  rewards: Reward[],
  reward: Reward,
  timestamp: string,
) {
  if (!isEquippableCosmetic(reward)) {
    return userRewards;
  }

  const hasReward = userRewards.some((ownedReward) => ownedReward.rewardId === reward.id);
  const nextRewards = hasReward
    ? userRewards
    : [
        ...userRewards,
        {
          rewardId: reward.id,
          purchasedAt: timestamp,
          equippedAt: null,
        },
      ];

  return nextRewards.map((ownedReward) => {
    if (ownedReward.rewardId === reward.id) {
      return { ...ownedReward, equippedAt: timestamp };
    }

    const ownedRewardType = rewards.find((item) => item.id === ownedReward.rewardId)?.type;
    if (ownedRewardType === reward.type) {
      return { ...ownedReward, equippedAt: null };
    }

    return ownedReward;
  });
}

export function unequipCosmeticTypeInState(
  userRewards: UserReward[],
  rewards: Reward[],
  type: "title" | "frame",
) {
  return userRewards.map((ownedReward) => {
    const rewardType = rewards.find((item) => item.id === ownedReward.rewardId)?.type;
    return rewardType === type ? { ...ownedReward, equippedAt: null } : ownedReward;
  });
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
