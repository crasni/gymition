export default function PublicProfileLoading() {
  return (
    <main className="public-profile-page loading-layout">
      <span className="public-profile-back loading-block" aria-hidden>
        <span className="skeleton-mark" />
        <span className="skeleton-line label" />
      </span>

      <div className="public-profile">
        <section className="profile-hero loading-block" aria-hidden>
          <span className="skeleton-avatar" />
          <span className="player-identity skeleton-copy">
            <span className="skeleton-line title" />
            <span className="skeleton-line body" />
            <span className="profile-identity-tags">
              <span className="skeleton-chip" />
              <span className="skeleton-chip" />
            </span>
          </span>
        </section>

        <section className="profile-inventory public-profile-badges loading-block loading-list" aria-hidden>
          <span className="skeleton-copy">
            <span className="skeleton-line heading" />
            <span className="skeleton-line label" />
          </span>
          <div className="badge-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="badge-card" key={index}>
                <span className="skeleton-mark" />
                <span className="skeleton-line body" />
                <span className="skeleton-line label" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
