import "server-only";

import { getDb } from "@/db/client";
import { requireCurrentUser } from "@/features/auth/session";
import { getOrCreateUser } from "./user-service";

export async function requireCurrentAppUser() {
  const authUser = await requireCurrentUser();
  const db = getDb();

  return getOrCreateUser(db, {
    id: authUser.id,
    email: authUser.email,
    username: authUser.name ?? authUser.email.split("@")[0] ?? "Gymition User",
  });
}
