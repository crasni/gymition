import { GymitionApp } from "@/features/app/GymitionApp";

export const dynamic = "force-dynamic";

export default async function WorkoutPage() {
  return <GymitionApp view="workout" />;
}
