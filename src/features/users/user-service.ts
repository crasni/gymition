import { eq } from "drizzle-orm";
import type { DbClient } from "@/db/client";
import { users } from "@/db/schema";

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
  const [user] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      username: input.username,
    })
    .returning();

  return user;
}

export async function getOrCreateUser(db: DbClient, input: CreateUserInput) {
  const existingUser = await getUserById(db, input.id);

  if (existingUser) {
    return existingUser;
  }

  return createUser(db, input);
}
