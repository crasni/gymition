import type { Exercise } from "@/features/economy/types";

export const seedExercises: Exercise[] = [
  {
    id: "bench_press",
    name: "Bench Press",
    category: "chest",
    measurementType: "reps_weight",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "lat_pulldown",
    name: "Lat Pulldown",
    category: "back",
    measurementType: "reps_weight",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "leg_press",
    name: "Leg Press",
    category: "legs",
    measurementType: "reps_weight",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "plank",
    name: "Plank",
    category: "core",
    measurementType: "duration",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "treadmill",
    name: "Treadmill",
    category: "cardio",
    measurementType: "duration",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "mobility_flow",
    name: "Mobility Warmup",
    category: "mobility",
    measurementType: "completion",
    defaultCoinValue: 10,
    isActive: true,
  },
];
