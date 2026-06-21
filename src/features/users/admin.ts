export const ADMIN_RESOURCE_BALANCE = 1_000_000;

export function isAdminEmail(email: string) {
  const adminEmails = process.env.ADMIN_EMAILS ?? "";
  return adminEmails
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}
