import { GymitionApp } from "@/features/app/GymitionApp";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return <GymitionApp view="dashboard" />;
}
