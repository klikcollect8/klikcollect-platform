"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { HERO_ASSETS } from "@/lib/hero-assets";

const INTERVAL_MS = 3500;

const SLIDE_COPY = [
  { eyebrow: "Nairobi", title: "Click & collect\nfrom vendors\nnear you." },
  { eyebrow: "Fresh", title: "Groceries\nready when\nyou are." },
  { eyebrow: "Trusted", title: "Specialty\nsellers in\none place." },
] as const;

/** Full-height auth-side carousel — soft fades into canvas like the homepage hero */
export default function AuthCarousel() {
  const slidesRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const prevActive = useRef(0);
  const paused = useRef(false);

  const goTo = useCallback((next: number) => {
    setActive((cur) => {
      const n = ((next % HERO_ASSETS.length) + HERO_ASSETS.length) % HERO_ASSETS.length;
      return n === cur ? cur : n;
    });
  }, []);

  useEffect(() => {
    const root = slidesRef.current;
    if (!root) return;
    const slides = root.querySelectorAll<HTMLElement>(".kc-auth-slide");
    gsap.set(slides, { autoAlpha: 0 });
    if (slides[0]) gsap.set(slides[0], { autoAlpha: 1 });
  }, []);

  useEffect(() => {
    const root = slidesRef.current;
    if (!root) return;
    const slides = root.querySelectorAll<HTMLElement>(".kc-auth-slide");
    const prev = prevActive.current;
    if (prev === active) return;

    const prevSlide = slides[prev];
    const nextSlide = slides[active];
    if (!prevSlide || !nextSlide) return;

    gsap.killTweensOf([prevSlide, nextSlide]);
    gsap
      .timeline()
      .to(prevSlide, { autoAlpha: 0, duration: 1.3, ease: "power2.inOut" })
      .to(nextSlide, { autoAlpha: 1, duration: 1.3, ease: "power2.inOut" }, 0);

    prevActive.current = active;
  }, [active]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (paused.current) return;
      setActive((c) => (c + 1) % HERO_ASSETS.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const copy = SLIDE_COPY[active % SLIDE_COPY.length];

  return (
    <div
      className="relative h-full min-h-[42svh] w-full overflow-hidden bg-[#f7f7f5] lg:min-h-screen"
      onMouseEnter={() => {
        paused.current = true;
      }}
      onMouseLeave={() => {
        paused.current = false;
      }}
    >
      <div ref={slidesRef} className="absolute inset-0">
        {HERO_ASSETS.map((src, i) => (
          <div key={src} className="kc-auth-slide absolute inset-0">
            <Image
              src={src}
              alt=""
              fill
              priority={i < 2}
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 58vw"
            />
          </div>
        ))}
      </div>

      {/* Soft blend into page canvas on the right (toward the form) */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[48%] max-w-none"
        style={{
          background:
            "linear-gradient(to left, #f7f7f5 0%, rgba(247,247,245,0.92) 22%, rgba(247,247,245,0.4) 55%, transparent 100%)",
        }}
      />
      {/* Bottom fade on mobile before form */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 lg:hidden"
        style={{
          background: "linear-gradient(to top, #f7f7f5 0%, transparent 100%)",
        }}
      />
      {/* Soft left edge so it never feels like a hard panel */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
        style={{
          background: "linear-gradient(to right, #f7f7f5 0%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 z-20 flex flex-col justify-end px-6 pb-10 pt-20 sm:px-10 lg:justify-between lg:px-12 lg:pb-14 lg:pt-12 xl:px-16">
        <Link
          href="/"
          className="hidden text-[15px] font-medium uppercase tracking-[0.14em] text-black lg:inline-block"
        >
          KLIKCOLLECT®
        </Link>
        <div className="max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            {copy.eyebrow}
          </p>
          <p className="mt-4 whitespace-pre-line text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium leading-[1.05] tracking-tight text-black">
            {copy.title}
          </p>
        </div>

        <div className="mt-8 flex items-center gap-2.5 lg:mt-0">
          {HERO_ASSETS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-px transition-all duration-500 ${
                i === active ? "w-10 bg-black" : "w-4 bg-black/20 hover:bg-black/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
