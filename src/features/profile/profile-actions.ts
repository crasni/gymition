"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireCurrentAppUser } from "@/features/users/current-user";
import { updateProfileSchema } from "./profile-validation";

export async function updateProfileAction(input: unknown) {
  const parsed = updateProfileSchema.parse(input);
  const appUser = await requireCurrentAppUser();
  const db = getDb();

  await db
    .update(users)
    .set({
      username: parsed.username,
      updatedAt: new Date(),
    })
    .where(eq(users.id, appUser.id));

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}
