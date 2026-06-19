import { z } from "zod";

export const purchaseRewardSchema = z.object({
  rewardId: z.string().min(1).max(120),
});

export type PurchaseRewardInput = z.infer<typeof purchaseRewardSchema>;
