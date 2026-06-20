import { z } from "zod";

export const setWeeklyGoalSchema = z.object({
  workoutTarget: z.number().int().min(1).max(14),
  cardioTarget: z.number().int().min(0).max(14),
});

export type SetWeeklyGoalInput = z.infer<typeof setWeeklyGoalSchema>;
