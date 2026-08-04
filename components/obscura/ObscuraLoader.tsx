"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/** Connecting % loader - mirrors Obscura studio intro */
export default function ObscuraLoader() {
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("kc-obscura-loaded") === "1") {
        setHidden(true);
        return;
      }
    } catch {
      /* private mode */
    }

    let cancelled = false;
    const start = performance.now();
    const duration = 1600;

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / duration);
      // ease in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setProgress(100);
        const el = rootRef.current;
        if (!el) {
          try {
            sessionStorage.setItem("kc-obscura-loaded", "1");
          } catch {
            /* ignore */
          }
          setHidden(true);
          return;
        }
        gsap.to(el, {
          opacity: 0,
          duration: 0.55,
          delay: 0.12,
          ease: "power2.out",
          onComplete: () => {
            try {
              sessionStorage.setItem("kc-obscura-loaded", "1");
            } catch {
              /* ignore */
            }
            if (!cancelled) setHidden(true);
          },
        });
      }
    };

    const raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      ref={rootRef}
      className="kc-loader fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#f7f7f5] text-black"
      aria-hidden
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-black/50">
        Connecting
      </p>
      <p
        className="mt-4 text-[64px] font-medium leading-none tracking-tight tabular-nums sm:text-[88px]"
        style={{ fontFamily: "var(--font-montreal), sans-serif" }}
      >
        {progress}%
      </p>
      <p
        className="mt-8 text-[15px] font-medium uppercase tracking-[0.22em]"
        style={{ fontFamily: "var(--font-montreal), sans-serif" }}
      >
        KLIKCOLLECT
        <span className="align-super text-[0.55em] tracking-normal">™</span>
      </p>
    </div>
  );
}
