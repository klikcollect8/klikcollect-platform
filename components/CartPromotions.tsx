"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import type { CartItem } from "@/types";
import { resolveProductImage } from "@/lib/product-image";
import { formatPrice } from "@/lib/currency";

const INTERVAL_MS = 4000;

type PromoSlide = {
  id: string;
  eyebrow: string;
  title: string;
  href: string;
  image: string;
  meta?: string;
};

function linePrice(item: CartItem) {
  return item.offerPrice ?? item.product.price ?? 0;
}

function slidesFromBag(items: CartItem[]): PromoSlide[] {
  return items
    .filter((item) => item.product)
    .map((item) => {
      const qty = item.quantity;
      return {
        id: `bag_${item.offerId || item.product.id}`,
        eyebrow: "In your bag",
        title: item.product.name,
        href: `/products/${item.product.id}${
          item.offerId ? `?offer=${encodeURIComponent(item.offerId)}` : ""
        }`,
        image: resolveProductImage(item.product.image),
        meta: `${qty} × ${formatPrice(linePrice(item))}`,
      };
    });
}

/** Cart carousel — only products currently in the bag */
export default function CartPromotions({ items }: { items: CartItem[] }) {
  const slidesRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const prevActive = useRef(0);
  const paused = useRef(false);

  const slides = useMemo(() => slidesFromBag(items), [items]);
  const slideKey = slides.map((s) => s.id).join("|");
  const slide = slides[active] ?? slides[0];

  const goTo = useCallback(
    (next: number) => {
      if (!slides.length) return;
      setActive((cur) => {
        const n = ((next % slides.length) + slides.length) % slides.length;
        return n === cur ? cur : n;
      });
    },
    [slides.length],
  );

  useEffect(() => {
    setActive(0);
    prevActive.current = 0;
  }, [slideKey]);

  useEffect(() => {
    const root = slidesRef.current;
    if (!root || !slides.length) return;
    const nodes = root.querySelectorAll<HTMLElement>(".kc-cart-promo-slide");
    gsap.set(nodes, { autoAlpha: 0 });
    if (nodes[0]) gsap.set(nodes[0], { autoAlpha: 1 });
  }, [slides.length, slides[0]?.id]);

  useEffect(() => {
    const root = slidesRef.current;
    if (!root || !slides.length) return;
    const nodes = root.querySelectorAll<HTMLElement>(".kc-cart-promo-slide");
    const prev = prevActive.current;
    if (prev === active) return;

    const prevSlide = nodes[prev];
    const nextSlide = nodes[active];
    if (!prevSlide || !nextSlide) {
      prevActive.current = active;
      return;
    }

    gsap.killTweensOf([prevSlide, nextSlide]);
    gsap
      .timeline()
      .to(prevSlide, { autoAlpha: 0, duration: 1.1, ease: "power2.inOut" })
      .to(nextSlide, { autoAlpha: 1, duration: 1.1, ease: "power2.inOut" }, 0);

    prevActive.current = active;
  }, [active, slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      if (paused.current) return;
      setActive((c) => (c + 1) % slides.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  if (!slide) return null;

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
      <div className="relative mx-auto w-full max-w-[1600px] lg:min-h-[40svh]">
        {/* Image sits behind so the title can overlap */}
        <div className="relative flex min-h-[30svh] items-center justify-center px-6 pb-8 pt-6 sm:px-10 lg:absolute lg:inset-y-0 lg:right-0 lg:flex lg:w-[58%] lg:items-center lg:justify-center lg:px-12 lg:pb-10 lg:pt-6">
          <div
            ref={slidesRef}
            className="relative aspect-square w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[380px]"
            style={{
              WebkitMaskImage:
                "radial-gradient(ellipse 74% 74% at 50% 50%, #000 38%, transparent 80%)",
              maskImage:
                "radial-gradient(ellipse 74% 74% at 50% 50%, #000 38%, transparent 80%)",
            }}
          >
            {slides.map((s, i) => (
              <div key={s.id} className="kc-cart-promo-slide absolute inset-0">
                <Image
                  src={s.image}
                  alt=""
                  fill
                  priority={i < 2}
                  className="object-contain object-center opacity-95"
                  sizes="(max-width: 1024px) 50vw, 380px"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 40%, rgba(247,247,245,0.55) 68%, #f7f7f5 100%)",
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Copy — wider so long names can spill over the image */}
        <div className="relative z-20 flex flex-col justify-center px-6 pb-6 pt-2 sm:px-10 lg:min-h-[40svh] lg:max-w-[62%] lg:px-14 lg:py-10 xl:px-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
            {slide.eyebrow}
          </p>

          <Link href={slide.href} className="mt-4 block min-w-0">
            <h2 className="line-clamp-2 text-[clamp(2.5rem,6vw,4.25rem)] font-medium leading-[1.05] tracking-tight text-black transition-opacity hover:opacity-55">
              {slide.title}
            </h2>
          </Link>

          {slide.meta ? (
            <p className="mt-5 text-[clamp(1.05rem,1.8vw,1.35rem)] font-medium tabular-nums tracking-tight text-black/70">
              {slide.meta}
            </p>
          ) : null}

          {slides.length > 1 ? (
            <div className="mt-8 flex items-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={`h-px transition-all duration-500 ${
                    i === active ? "w-8 bg-black" : "w-3 bg-black/20 hover:bg-black/40"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Soft fade into the bag content below — no hard edge */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-16 sm:h-20"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(247,247,245,0.55) 45%, #f7f7f5 100%)",
        }}
      />
    </section>
  );
}
