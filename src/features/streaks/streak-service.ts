import { localDateKey } from "@/lib/dates";

const oneDayMs = 24 * 60 * 60 * 1000;

export function nextLoginStreak(lastClaimDate: string | null, currentStreak: number, now = new Date()) {
  if (!lastClaimDate) {
    return 1;
  }

  const today = localDateKey(now);
  if (lastClaimDate === today) {
    return currentStreak;
  }

  const yesterday = localDateKey(new Date(now.getTime() - oneDayMs));
  if (lastClaimDate === yesterday) {
    return currentStreak + 1;
  }

  return 1;
}
