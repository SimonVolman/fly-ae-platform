"use client";

import Image from "next/image";

export function Mission() {
  return (
    <section className="mission-section" aria-labelledby="mission-title">
      <article className="mission-hero">
        <Image className="mission-aircraft" src="/mission-figma.png" alt="" width={1024} height={493} unoptimized aria-hidden="true" />
        <div className="mission-copy">
          <div className="mission-intro">
            <h2 id="mission-title">Our mission</h2>
            <p>There is no product on the market today built specifically for aviation experts to securely store and share proprietary data. If you’re tired of dropping your files into boxes or relying on yet another way to transfer them, fly.ae gives your aviation data a place of its own.</p>
          </div>
          <ul>
            <li>For now, fly.ae is <strong>free</strong> to use.</li>
            <li>You can <strong>store your files</strong> for up to <strong>one year</strong> with virtually unlimited space.</li>
            <li>We know that VBSI data can take up a lot of it, so you’ve come to the right place — and you won’t be disappointed.</li>
          </ul>
        </div>
      </article>
      <div className="mission-notices">
        <article className="mission-notice mission-notice-neutral"><p><strong>fly.ae is exclusively for aviation data.</strong> For everything else, please find another box or another way to transfer it. Don’t overstay your welcome.</p></article>
        <article className="mission-notice mission-notice-warning"><Image className="mission-warning-art" src="/mission-warning.svg" alt="" width={96} height={96} aria-hidden="true" /><h3>One warning:</h3><p>anything unrelated to flying machines — including personal files, entertainment videos, or pornographic content — may be removed, and the associated account may be blocked.</p></article>
      </div>
    </section>
  );
}
