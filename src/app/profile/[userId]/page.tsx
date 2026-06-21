import { notFound } from "next/navigation";
import { PublicProfileView } from "@/features/profile/PublicProfileView";
import { loadPublicProfile } from "@/features/profile/public-profile-service";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const profile = await loadPublicProfile(userId);

  if (!profile) {
    notFound();
  }

  return (
    <main className="public-profile-page">
      <PublicProfileView profile={profile} />
    </main>
  );
}
