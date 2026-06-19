import type { LedgerEntry, LedgerReason } from "./types";
import { createId } from "@/lib/ids";

export const REWARD_RULES = {
  dailyLogin: { coins: 20, xp: 10 },
  workoutCompleted: { coins: 50, xp: 50 },
  exerciseLogged: { coins: 10, xp: 10 },
  streakBonusPerDay: 5,
  streakBonusCap: 50,
};

export function calculateStreakBonus(streak: number) {
  return Math.min(streak * REWARD_RULES.streakBonusPerDay, REWARD_RULES.streakBonusCap);
}

export function createLedgerEntry(
  amount: number,
  reason: LedgerReason,
  sourceType: LedgerEntry["sourceType"],
  sourceId: string,
) {
  return {
    id: createId("ledger"),
    amount,
    reason,
    sourceType,
    sourceId,
    createdAt: new Date().toISOString(),
  } satisfies LedgerEntry;
}
