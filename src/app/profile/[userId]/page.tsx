import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
      <Link className="public-profile-back" href="/dashboard">
        <ArrowLeft size={16} aria-hidden />
        Dashboard
      </Link>
      <PublicProfileView profile={profile} />
    </main>
  );
}
