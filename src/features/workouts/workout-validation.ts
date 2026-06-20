import { z } from "zod";

export const workoutEntryInputSchema = z.object({
  exerciseId: z.string().min(1).max(120),
  sets: z.number().int().min(1).max(50).optional(),
  reps: z.number().int().min(1).max(1000).optional(),
  weight: z.number().int().min(0).max(2000).optional(),
  durationSeconds: z.number().int().min(1).max(24 * 60 * 60).optional(),
  distanceMeters: z.number().int().min(0).max(1_000_000).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const completeWorkoutSchema = z.object({
  entries: z.array(workoutEntryInputSchema).min(1).max(80),
});

export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>;
