import type { Reward } from "@/features/economy/types";

export const seedRewards: Reward[] = [
  {
    id: "title_early_grinder",
    name: "早鳥訓練者",
    description: "給願意出現訓練的個人稱號。",
    cost: 80,
    type: "title",
    metadata: { title: "早鳥訓練者" },
    isActive: true,
  },
  {
    id: "badge_consistent",
    name: "穩定徽章",
    description: "給穩定訓練節奏的小徽章。",
    cost: 120,
    type: "badge",
    metadata: { badge: "consistent" },
    isActive: true,
  },
  {
    id: "theme_green_room",
    name: "暖光主題",
    description: "保留給未來主題外觀的獎勵。",
    cost: 180,
    type: "theme",
    metadata: { theme: "warm-room" },
    isActive: true,
  },
];
