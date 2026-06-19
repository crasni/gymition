import "server-only";

import { currentUser } from "@clerk/nextjs/server";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

export type AuthSession = {
  user: AuthUser;
};

export async function getCurrentUser(): Promise<AuthUser | null> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  if (!user || !email) {
    return null;
  }

  return {
    id: user.id,
    email,
    name: user.fullName ?? user.username ?? undefined,
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication is required.");
  }

  return user;
}
