import { eq } from "drizzle-orm";
import type { DbClient } from "@/db/client";
import { users } from "@/db/schema";
import { hasTestResources, resolveUserRole, TEST_RESOURCE_BALANCE } from "@/features/users/roles";

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
  const role = resolveUserRole(input.email);
  const hasResources = hasTestResources(role);
  const [user] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      username: input.username,
      coins: hasResources ? TEST_RESOURCE_BALANCE : 0,
      xp: hasResources ? TEST_RESOURCE_BALANCE : 0,
      role,
    })
    .returning();

  return user;
}

export async function getOrCreateUser(db: DbClient, input: CreateUserInput) {
  const existingUser = await getUserById(db, input.id);

  if (existingUser) {
    const role = resolveUserRole(input.email);
    const hasResources = hasTestResources(role);
    const isDemotingTester = existingUser.role === "tester" && role === "user";
    if (
      role !== existingUser.role ||
      (hasResources && (existingUser.coins < TEST_RESOURCE_BALANCE || existingUser.xp < TEST_RESOURCE_BALANCE))
    ) {
      const [updatedUser] = await db
        .update(users)
        .set({
          role,
          coins: hasResources ? TEST_RESOURCE_BALANCE : isDemotingTester ? 0 : existingUser.coins,
          xp: hasResources ? TEST_RESOURCE_BALANCE : isDemotingTester ? 0 : existingUser.xp,
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
