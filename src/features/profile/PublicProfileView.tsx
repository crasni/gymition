import type { CSSProperties } from "react";
import { Award, CircleDollarSign, Dumbbell, Flame, Shield, Sparkles, Star } from "lucide-react";
import type { Reward } from "@/features/economy/types";
import type { PublicProfile } from "@/features/profile/public-profile-service";
import { cosmeticAccent, cosmeticRarity } from "@/features/rewards/cosmetic-rules";

export function PublicProfileView({ profile }: { profile: PublicProfile }) {
  const { user, equippedTitle, equippedFrame, badges } = profile;

  return (
    <div className="public-profile">
      <section
        className={equippedFrame ? `profile-hero framed frame-${equippedFrame.metadata.frameClass ?? "custom"}` : "profile-hero"}
        style={{ "--profile-frame-accent": equippedFrame ? cosmeticAccent(equippedFrame) : "#e5c387" } as CSSProperties}
      >
        <div className="player-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
        <div className="player-identity">
          <h2>{user.username}</h2>
          <p className={equippedTitle ? "profile-title cosmetic-title-display" : "profile-title"}>
            {equippedTitle?.metadata.title ?? "No title equipped"}
          </p>
          <div className="profile-identity-tags">
            <span>Level {user.level}</span>
            <span>{user.currentStreak} day streak</span>
            {equippedFrame && <span>{equippedFrame.name} frame</span>}
          </div>
        </div>
      </section>

      <section className="profile-inventory public-profile-badges">
        <div className="section-heading">
          <div>
            <h2>Badges collected</h2>
            <p>{badges.length} earned</p>
          </div>
        </div>
        {badges.length ? (
          <div className="badge-grid">
            {badges.map((badge) => (
              <div className={`badge-card owned ${cosmeticRarity(badge)}`} key={badge.id}>
                <CosmeticMark reward={badge} />
                <strong>{badge.name}</strong>
                <span>{badge.description}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">No badges collected yet.</p>
        )}
      </section>
    </div>
  );
}

function CosmeticMark({ reward }: { reward: Reward }) {
  return (
    <span
      className={`cosmetic-mark ${reward.type} ${cosmeticRarity(reward)}`}
      style={{ "--cosmetic-accent": cosmeticAccent(reward) } as CSSProperties}
    >
      {renderCosmeticIcon(reward)}
    </span>
  );
}

function renderCosmeticIcon(reward: Reward) {
  const icon = reward.metadata.icon;
  if (reward.type === "frame") return <Shield size={18} aria-hidden />;
  if (reward.type === "title") return <Sparkles size={18} aria-hidden />;
  if (icon === "flame") return <Flame size={18} aria-hidden />;
  if (icon === "coin") return <CircleDollarSign size={18} aria-hidden />;
  if (icon === "star") return <Star size={18} aria-hidden />;
  if (icon === "dumbbell") return <Dumbbell size={18} aria-hidden />;
  return <Award size={18} aria-hidden />;
}
