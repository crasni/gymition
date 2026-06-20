import { GymitionApp } from "@/features/app/GymitionApp";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  return <GymitionApp view="profile" />;
}
