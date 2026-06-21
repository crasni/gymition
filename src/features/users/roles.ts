import "server-only";

export const TEST_RESOURCE_BALANCE = 1_000_000;

export const userRoles = ["user", "tester"] as const;

export type UserRole = (typeof userRoles)[number];

export function isTesterEmail(email: string) {
  const testerEmails = process.env.TESTER_EMAILS ?? "";
  return testerEmails
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

export function resolveUserRole(email: string): UserRole {
  return isTesterEmail(email) ? "tester" : "user";
}

export function hasTestResources(role: UserRole) {
  return role === "tester";
}

export function canBypassCosmeticLocks(role: UserRole) {
  return role === "tester";
}

export function shouldAppearOnLeaderboard(role: UserRole) {
  return role === "user";
}
