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

export const completeWorkoutSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("detailed"),
    entries: z.array(workoutEntryInputSchema).min(1).max(80),
  }),
  z.object({
    mode: z.literal("simple"),
    durationSeconds: z.number().int().min(60).max(24 * 60 * 60),
    notes: z.string().trim().max(500).optional(),
  }),
]);

export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>;
