import { GymitionApp } from "@/features/app/GymitionApp";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  return <GymitionApp view="leaderboard" />;
}
