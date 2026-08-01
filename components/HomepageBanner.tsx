"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { HERO_ASSETS, HERO_COPY } from "@/lib/hero-assets";

const INTERVAL_MS = 3500;

/** Full-bleed marketplace hero: 1/3 copy · 2/3 image, soft left fade */
export default function HomepageBanner() {
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
    const slides = root.querySelectorAll<HTMLElement>(".kc-hero-slide");
    gsap.set(slides, { autoAlpha: 0 });
    if (slides[0]) gsap.set(slides[0], { autoAlpha: 1 });
  }, []);

  useEffect(() => {
    const root = slidesRef.current;
    if (!root) return;
    const slides = root.querySelectorAll<HTMLElement>(".kc-hero-slide");
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

  return (
    <section
      className="relative w-full overflow-hidden bg-[#f7f7f5]"
      onMouseEnter={() => {
        paused.current = true;
      }}
      onMouseLeave={() => {
        paused.current = false;
      }}
    >
      <div className="grid min-h-0 w-full grid-cols-1 lg:min-h-[78svh] lg:grid-cols-12">
        {/* Copy — ~1/3 */}
        <div className="relative z-20 flex flex-col justify-center px-4 py-10 sm:px-10 sm:py-16 lg:col-span-4 lg:px-14 lg:py-24 xl:px-20">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-black/40 sm:mb-5 sm:text-[12px]">
            {HERO_COPY.eyebrow}
          </p>
          <h1 className="max-w-[10ch] text-[clamp(2.15rem,9vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.04em] text-black">
            {HERO_COPY.headline}
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-black/50 sm:mt-6 sm:text-[18px]">
            {HERO_COPY.sub}
          </p>

          <div className="mt-8 sm:mt-10">
            <Link
              href={HERO_COPY.ctaHref}
              className="inline-flex min-h-12 items-center bg-black px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-80 sm:px-8 sm:py-4"
            >
              {HERO_COPY.cta}
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-1 sm:mt-12 sm:gap-2.5">
            {HERO_ASSETS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className="flex h-11 items-center px-1"
              >
                <span
                  className={`block h-px transition-all duration-500 ${
                    i === active ? "w-10 bg-black" : "w-4 bg-black/20"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Image — ~2/3 full height, fades into canvas */}
        <div className="relative min-h-[36svh] w-full sm:min-h-[42svh] lg:col-span-8 lg:min-h-[78svh]">
          <div ref={slidesRef} className="absolute inset-0">
            {HERO_ASSETS.map((src, i) => (
              <div key={src} className="kc-hero-slide absolute inset-0">
                <Image
                  src={src}
                  alt=""
                  fill
                  priority={i < 2}
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 70vw"
                />
              </div>
            ))}
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[55%] max-w-none lg:w-[38%]"
            style={{
              background:
                "linear-gradient(to right, #f7f7f5 0%, rgba(247,247,245,0.9) 28%, rgba(247,247,245,0.35) 55%, transparent 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 lg:hidden"
            style={{
              background: "linear-gradient(to bottom, #f7f7f5 0%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
