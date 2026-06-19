import { z } from "zod";

export const updateProfileSchema = z.object({
  username: z.string().trim().min(1).max(40),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
