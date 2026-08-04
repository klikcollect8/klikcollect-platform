"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Obscura-style scroll reveal - fade + lift + slight blur clear */
export default function Reveal({
  children,
  className = "",
  delay = 0,
  y = 56,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Prefer the nearest scroll container (docked shells); fall back to window.
    const scroller =
      (el.closest(".kc-app-scroll") as HTMLElement | null) || undefined;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 1.15,
          delay,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            scroller: scroller || undefined,
            start: "top 92%",
            toggleActions: "play none none none",
            // If already in view (or scroller mis-detected), still reveal.
            once: true,
          },
        },
      );
    }, el);

    // Safety: never leave content permanently invisible.
    const failsafe = window.setTimeout(() => {
      const opacity = Number(getComputedStyle(el).opacity);
      if (opacity < 0.05) {
        gsap.set(el, { opacity: 1, y: 0, filter: "blur(0px)" });
      }
    }, 600);

    return () => {
      window.clearTimeout(failsafe);
      ctx.revert();
    };
  }, [delay, y]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
