import { eq } from "drizzle-orm";
import type { DbClient } from "@/db/client";
import { users } from "@/db/schema";
import { ADMIN_RESOURCE_BALANCE, isAdminEmail } from "@/features/users/admin";

export type CreateUserInput = {
  id: string;
  email: string;
  username: string;
};

export async function getUserById(db: DbClient, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export async function getUserByEmail(db: DbClient, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function createUser(db: DbClient, input: CreateUserInput) {
  const isAdmin = isAdminEmail(input.email);
  const [user] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      username: input.username,
      coins: isAdmin ? ADMIN_RESOURCE_BALANCE : 0,
      xp: isAdmin ? ADMIN_RESOURCE_BALANCE : 0,
      isAdmin,
    })
    .returning();

  return user;
}

export async function getOrCreateUser(db: DbClient, input: CreateUserInput) {
  const existingUser = await getUserById(db, input.id);

  if (existingUser) {
    const shouldBeAdmin = existingUser.isAdmin || isAdminEmail(input.email);
    if (
      shouldBeAdmin !== existingUser.isAdmin ||
      (shouldBeAdmin && (existingUser.coins < ADMIN_RESOURCE_BALANCE || existingUser.xp < ADMIN_RESOURCE_BALANCE))
    ) {
      const [updatedUser] = await db
        .update(users)
        .set({
          isAdmin: shouldBeAdmin,
          coins: shouldBeAdmin ? ADMIN_RESOURCE_BALANCE : existingUser.coins,
          xp: shouldBeAdmin ? ADMIN_RESOURCE_BALANCE : existingUser.xp,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      return updatedUser;
    }

    return existingUser;
  }

  return createUser(db, input);
}
