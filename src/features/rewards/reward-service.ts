import type { Reward } from "@/features/economy/types";

export const seedRewards: Reward[] = [
  {
    id: "title_early_grinder",
    name: "Early Grinder",
    description: "A title for showing up before excuses do.",
    cost: 80,
    type: "title",
    metadata: { title: "Early Grinder" },
    isActive: true,
  },
  {
    id: "badge_consistent",
    name: "Consistency Badge",
    description: "A small badge for steady training rhythm.",
    cost: 120,
    type: "badge",
    metadata: { badge: "consistent" },
    isActive: true,
  },
  {
    id: "theme_green_room",
    name: "Warm Light Theme",
    description: "Reserved for a future visual theme reward.",
    cost: 180,
    type: "theme",
    metadata: { theme: "warm-room" },
    isActive: true,
  },
];
