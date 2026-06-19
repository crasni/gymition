import type { Exercise } from "@/features/economy/types";

export const seedExercises: Exercise[] = [
  {
    id: "bench_press",
    name: "臥推",
    category: "chest",
    measurementType: "reps_weight",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "lat_pulldown",
    name: "滑輪下拉",
    category: "back",
    measurementType: "reps_weight",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "leg_press",
    name: "腿推",
    category: "legs",
    measurementType: "reps_weight",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "plank",
    name: "棒式",
    category: "core",
    measurementType: "duration",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "treadmill",
    name: "跑步機",
    category: "cardio",
    measurementType: "duration",
    defaultCoinValue: 10,
    isActive: true,
  },
  {
    id: "mobility_flow",
    name: "活動度暖身",
    category: "mobility",
    measurementType: "completion",
    defaultCoinValue: 10,
    isActive: true,
  },
];
