import Image from "next/image";

export function MaintenancePage() {
  return (
    <main className="maintenance-page">
      <div className="maintenance-art" aria-hidden="true">
        <Image
          src="/Desktop-Signboard-clean.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="maintenance-image"
        />
      </div>

      <div className="maintenance-content">
        <p className="maintenance-kicker">fly.ae</p>
        <h1>We’re making things better.</h1>
        <p className="maintenance-copy">
          fly.ae is temporarily unavailable while we complete scheduled
          maintenance. We’ll be back shortly.
        </p>
        <div className="maintenance-status" role="status">
          <span className="maintenance-dot" />
          Maintenance in progress
        </div>
      </div>
    </main>
  );
}
