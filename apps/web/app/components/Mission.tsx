"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function Mission() {
  const section = useRef<HTMLElement>(null);
  const [loadImage, setLoadImage] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    let pageLoaded = document.readyState === "complete";
    let nearViewport = false;
    let scheduled = false;
    let idleHandle: number | undefined;
    let timer: number | undefined;

    function scheduleImage() {
      if (!pageLoaded || !nearViewport || scheduled) return;
      scheduled = true;
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => setLoadImage(true), {
          timeout: 1500,
        });
      } else {
        timer = window.setTimeout(() => setLoadImage(true), 0);
      }
    }

    function onPageLoad() {
      pageLoaded = true;
      scheduleImage();
    }

    window.addEventListener("load", onPageLoad, { once: true });
    const observer = typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(
          ([entry]) => {
            nearViewport = entry.isIntersecting;
            scheduleImage();
          },
          { rootMargin: "200px" },
        );

    if (observer && section.current) {
      observer.observe(section.current);
    } else {
      nearViewport = true;
      scheduleImage();
    }

    return () => {
      window.removeEventListener("load", onPageLoad);
      observer?.disconnect();
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <section ref={section} className="mission-section" aria-labelledby="mission-title">
      {loadImage && (
        <picture
          className={`mission-image${imageReady ? " is-loaded" : ""}`}
        >
          <source media="(max-width: 640px)" srcSet="/mission-aircraft-mobile.webp" />
          <Image
            src="/mission-aircraft.webp"
            alt=""
            width={1920}
            height={421}
            unoptimized
            loading="eager"
            decoding="async"
            onLoad={() => setImageReady(true)}
          />
        </picture>
      )}
      <div className="mission-content">
        <h2 id="mission-title">Our mission</h2>
        <p>
          There is no product on the market today that gives aviation experts a
          dedicated way to share proprietary data. If you are tired of dropping
          files into generic boxes or transferring them through third parties,
          fly.ae gives you a secure, aviation-focused place to share them.
        </p>
      </div>
    </section>
  );
}
