export function levelFromXp(totalXp: number) {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

export function xpForNextLevel(level: number) {
  return Math.pow(level, 2) * 100;
}
