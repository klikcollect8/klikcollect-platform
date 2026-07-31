"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Product } from "@/types";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Sticky interactive case-study scroll — Obscura project energy, marketplace products */
export default function FeaturedScroll({ products }: { products: Product[] }) {
  const root = useRef<HTMLElement>(null);
  const items = products.slice(0, 3);

  useEffect(() => {
    const section = root.current;
    if (!section || items.length < 2) return;

    const panels = section.querySelectorAll<HTMLElement>(".kc-feat-panel");
    const imgs = section.querySelectorAll<HTMLElement>(".kc-feat-img");
    if (!panels.length) return;

    const ctx = gsap.context(() => {
      gsap.set(panels, { autoAlpha: 0, y: 28 });
      gsap.set(panels[0], { autoAlpha: 1, y: 0 });
      gsap.set(imgs, { autoAlpha: 0, scale: 1.06 });
      gsap.set(imgs[0], { autoAlpha: 1, scale: 1 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${items.length * 90}%`,
          pin: true,
          scrub: 0.85,
          anticipatePin: 1,
        },
      });

      items.forEach((_, i) => {
        if (i === 0) return;
        tl.to(
          panels[i - 1],
          { autoAlpha: 0, y: -24, duration: 0.45, ease: "power2.inOut" },
          i,
        )
          .to(
            imgs[i - 1],
            { autoAlpha: 0, scale: 1.04, duration: 0.45, ease: "power2.inOut" },
            i,
          )
          .fromTo(
            panels[i],
            { autoAlpha: 0, y: 28 },
            { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.inOut" },
            i,
          )
          .fromTo(
            imgs[i],
            { autoAlpha: 0, scale: 1.08 },
            { autoAlpha: 1, scale: 1, duration: 0.55, ease: "power2.out" },
            i,
          );
      });
    }, section);

    return () => ctx.revert();
  }, [items.length]);

  if (!items.length) return null;

  return (
    <section ref={root} className="relative min-h-[100svh] bg-[#f7f7f5]">
      <div className="mx-auto grid h-[100svh] max-w-[1280px] grid-cols-1 items-center gap-8 px-5 sm:px-8 lg:grid-cols-12 lg:gap-12">
        <div className="relative order-2 aspect-[4/5] overflow-hidden bg-black/[0.03] lg:order-1 lg:col-span-7 lg:aspect-auto lg:h-[72vh]">
          {items.map((p) => (
            <div key={p.id} className="kc-feat-img absolute inset-0">
              <Image
                src={resolveProductImage(p.image)}
                alt={p.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 58vw"
                priority={p.id === items[0]?.id}
              />
            </div>
          ))}
        </div>

        <div className="relative order-1 lg:order-2 lg:col-span-5">
          <p className="mb-6 text-[11px] uppercase tracking-[0.22em] text-black/40">
            02 — featured finds
          </p>
          <div className="relative min-h-[220px]">
            {items.map((p, i) => (
              <div key={p.id} className="kc-feat-panel absolute inset-x-0 top-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-black/35">
                  (Case Study) · {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-[clamp(1.5rem,2.8vw,2.25rem)] font-medium leading-[1.1] tracking-tight">
                  {p.name}
                </h3>
                <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-black/55">
                  {p.description ||
                    "Fresh groceries and everyday essentials — ready for click & collect."}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-black/40">
                  <span>{p.category || "Catalogue"}</span>
                  <span>Click & Collect</span>
                  <span>KES</span>
                </div>
                <p className="mt-6 text-[20px] font-medium tabular-nums">
                  {formatPrice(p.price)}
                </p>
                <Link
                  href={`/products/${p.id}`}
                  className="mt-5 inline-flex text-[14px] font-medium underline underline-offset-[6px] decoration-black/25 transition-colors hover:decoration-black"
                >
                  See more →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
