"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { HERO_ASSETS } from "@/lib/hero-assets";

const INTERVAL_MS = 4500;

/** Left atmosphere — full-bleed product photography with quiet type */
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
      .to(prevSlide, { autoAlpha: 0, duration: 1.5, ease: "power2.inOut" })
      .to(nextSlide, { autoAlpha: 1, duration: 1.5, ease: "power2.inOut" }, 0);

    prevActive.current = active;
  }, [active]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (paused.current) return;
      setActive((c) => (c + 1) % HERO_ASSETS.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative h-[34svh] w-full overflow-hidden bg-[#e8e8e4] lg:h-[100svh]"
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
              className="object-cover object-center scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 58vw"
            />
          </div>
        ))}
      </div>

      {/* Soft top/left veil — keeps type readable, photo stays present */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(180deg, rgba(247,247,245,0.42) 0%, rgba(247,247,245,0.05) 38%, rgba(247,247,245,0.28) 72%, rgba(247,247,245,0.55) 100%)",
        }}
      />

      {/* Desktop fade into form column */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[2] hidden w-[28%] lg:block"
        style={{
          background:
            "linear-gradient(to left, #f7f7f5 0%, rgba(247,247,245,0.7) 40%, transparent 100%)",
        }}
      />

      {/* Mobile fade into form */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-16 lg:hidden"
        style={{
          background: "linear-gradient(to top, #f7f7f5 0%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 z-10 flex flex-col justify-between px-6 py-5 sm:px-8 lg:px-10 lg:py-9 xl:px-12">
        <Link
          href="/"
          className="w-fit text-[13px] font-medium uppercase tracking-[0.16em] text-black transition-opacity hover:opacity-50"
        >
          KLIKCOLLECT®
        </Link>

        <div className="max-w-[17.5rem] lg:pb-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/45">
            Nairobi · KES
          </p>
          <p className="mt-2.5 text-[clamp(1.25rem,2.2vw,1.75rem)] font-medium leading-[1.18] tracking-tight text-black">
            Fresh picks from vendors near you.
          </p>

          <div className="mt-5 flex items-center gap-1.5 lg:mt-6">
            {HERO_ASSETS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-px transition-all duration-500 ${
                  i === active ? "w-7 bg-black" : "w-2.5 bg-black/20 hover:bg-black/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
