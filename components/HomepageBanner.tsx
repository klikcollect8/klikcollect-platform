"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HERO_ASSETS, HERO_COPY } from "@/lib/hero-assets";
import type { HomeHero } from "@/lib/home-page-data";

const INTERVAL_MS = 3500;

const DEFAULT_HERO: HomeHero = {
  eyebrow: HERO_COPY.eyebrow,
  headline: HERO_COPY.headline,
  sub: HERO_COPY.sub,
  cta: HERO_COPY.cta,
  ctaHref: HERO_COPY.ctaHref,
  images: [...HERO_ASSETS],
};

/** Full-bleed marketplace hero — CSS fades (no GSAP on critical path). */
export default function HomepageBanner({
  initial,
}: {
  initial?: HomeHero | null;
}) {
  const cms = initial?.images?.length ? initial : DEFAULT_HERO;
  const images = cms.images.length ? cms.images : HERO_ASSETS;
  const [active, setActive] = useState(0);
  const paused = useRef(false);

  const goTo = useCallback(
    (next: number) => {
      setActive((cur) => {
        const n = ((next % images.length) + images.length) % images.length;
        return n === cur ? cur : n;
      });
    },
    [images.length],
  );

  useEffect(() => {
    if (images.length < 2) return;
    const id = window.setInterval(() => {
      if (paused.current) return;
      setActive((c) => (c + 1) % images.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [images.length]);

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
        <div className="relative z-20 flex flex-col justify-center px-4 py-10 sm:px-10 sm:py-16 lg:col-span-4 lg:px-14 lg:py-24 xl:px-20">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.28em] text-black/40 sm:mb-5 sm:text-[12px]">
            {cms.eyebrow}
          </p>
          <h1 className="max-w-[10ch] text-[clamp(2.15rem,9vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.04em] text-black">
            {cms.headline}
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-black/50 sm:mt-6 sm:text-[18px]">
            {cms.sub}
          </p>

          <div className="mt-8 sm:mt-10">
            <Link
              href={cms.ctaHref}
              className="inline-flex min-h-12 items-center bg-black px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-80 sm:px-8 sm:py-4"
            >
              {cms.cta}
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-1 sm:mt-12 sm:gap-2.5">
            {images.map((_, i) => (
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

        <div className="relative min-h-[36svh] w-full sm:min-h-[42svh] lg:col-span-8 lg:min-h-[78svh]">
          <div className="absolute inset-0">
            {images.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
                  i === active ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden={i !== active}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  priority={i === 0}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 100vw, 70vw"
                  unoptimized={src.startsWith("http")}
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
              background:
                "linear-gradient(to bottom, #f7f7f5 0%, transparent 100%)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
