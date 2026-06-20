import type { LedgerEntry, LedgerReason } from "./types";
import { createId } from "@/lib/ids";

export const REWARD_RULES = {
  dailyLogin: { coins: 10, xp: 10 },
  workoutCompleted: { coins: 35, xp: 45 },
  exerciseLogged: { coins: 2, xp: 8 },
  streakBonusCap: 20,
};

export function calculateStreakBonus(streak: number) {
  if (streak >= 30) return REWARD_RULES.streakBonusCap;
  if (streak >= 14) return 15;
  if (streak >= 7) return 10;
  if (streak >= 3) return 5;
  return 0;
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
