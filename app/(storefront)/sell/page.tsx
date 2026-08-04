"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { HERO_ASSETS } from "@/lib/hero-assets";
import Reveal from "@/components/obscura/Reveal";
import SellApplicationPanel from "@/components/SellApplicationPanel";
import { openSellApplicationTracker } from "@/components/SellApplicationTrackerPanel";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useSignInModal } from "@/components/SignInModalProvider";

const HERO_IMAGE = HERO_ASSETS[2] || HERO_ASSETS[0];
const BAND_IMAGE = HERO_ASSETS[5] || HERO_ASSETS[1] || HERO_IMAGE;

const STEPS = [
  {
    n: "01",
    title: "Apply",
    body: "A guided questionnaire about your shop, products, and fulfilment.",
  },
  {
    n: "02",
    title: "Review",
    body: "We check quality, photos, legitimacy, and whether you can deliver reliably.",
  },
  {
    n: "03",
    title: "Launch",
    body: "List your catalogue and start selling to local KlikCollect shoppers.",
  },
] as const;

const WHY = [
  {
    title: "Built-in demand",
    body: "Shoppers already come for groceries and everyday essentials.",
  },
  {
    title: "Local focus",
    body: "Neighbourhood-aware fulfilment that fits how Nairobi shops operate.",
  },
  {
    title: "Curated standards",
    body: "We admit sellers who can keep quality, honesty, and stock discipline.",
  },
  {
    title: "Guided onboarding",
    body: "One question per screen. Other always lets you type your own answer.",
  },
] as const;

const WHO = [
  "Grocery and pantry makers with consistent stock",
  "Fresh produce and dairy sellers with proper storage",
  "Household and personal-care brands ready to fulfil",
  "Neighbourhood shops that want a sharper digital storefront",
] as const;

const LOOK_FOR = [
  "Clear product photos and honest descriptions",
  "Reliable fulfilment within the areas you name",
  "Inventory you can keep accurate week to week",
  "A legitimate business setup, or a clear path to one",
] as const;

export default function SellPage() {
  const heroRef = useRef<HTMLElement>(null);
  const { isSignedIn, loading: authLoading } = useUserAuth();
  const { showSignInModal } = useSignInModal();
  const [applyOpen, setApplyOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  async function startApplication() {
    if (authLoading || starting) return;
    if (!isSignedIn) {
      showSignInModal("Sign in to apply to sell", { redirect: "/sell" });
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/curation/mine", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        const apps = json.data?.applications || [];
        const pending = apps.find(
          (a: { status?: string }) => a.status === "pending",
        );
        if (pending) {
          openSellApplicationTracker();
          return;
        }
      }
      setApplyOpen(true);
    } catch {
      setApplyOpen(true);
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    const root = heroRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll("[data-hero]"),
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.1,
          ease: "power3.out",
          delay: 0.08,
        },
      );
      gsap.fromTo(
        root.querySelector("[data-hero-image]"),
        { opacity: 0, scale: 1.04 },
        { opacity: 1, scale: 1, duration: 1.4, ease: "power2.out" },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#f7f7f5] text-black">
      <section
        ref={heroRef}
        className="relative w-full overflow-hidden bg-[#f7f7f5]"
      >
        <div className="grid min-h-0 w-full grid-cols-1 lg:min-h-[86svh] lg:grid-cols-12">
          <div className="relative z-20 flex flex-col justify-center px-4 py-14 sm:px-10 sm:py-20 lg:col-span-5 lg:px-14 lg:py-24 xl:px-20">
            <p
              data-hero
              className="text-[17px] font-medium uppercase tracking-[0.14em] text-black sm:text-[20px]"
            >
              KLIKCOLLECT
              <span className="align-super text-[0.55em] tracking-normal">
                ™
              </span>
            </p>
            <h1
              data-hero
              className="mt-6 max-w-[11ch] text-[clamp(2.6rem,8.5vw,4.75rem)] font-medium leading-[1.02] tracking-[-0.04em]"
            >
              Sell where shoppers already are.
            </h1>
            <p
              data-hero
              className="mt-5 max-w-sm text-[15px] leading-relaxed text-black/50 sm:mt-6 sm:text-[17px]"
            >
              Apply once. We review your shop in detail, then help you go live
              on a curated local marketplace.
            </p>
            <div
              data-hero
              className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 sm:mt-10"
            >
              <button
                type="button"
                onClick={() => void startApplication()}
                disabled={starting}
                className="inline-flex min-h-12 items-center bg-black px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-80 disabled:opacity-50 sm:px-8"
              >
                {starting ? "Checking..." : "Start application"}
              </button>
              <a
                href="#how"
                className="text-[13px] font-medium underline underline-offset-[6px] decoration-black/25 transition-colors hover:decoration-black"
              >
                How it works
              </a>
            </div>
          </div>

          <div
            data-hero-image
            className="relative min-h-[42svh] w-full sm:min-h-[50svh] lg:col-span-7 lg:min-h-[86svh]"
          >
            {HERO_IMAGE ? (
              <Image
                src={HERO_IMAGE}
                alt=""
                fill
                priority
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 58vw"
                unoptimized={HERO_IMAGE.startsWith("http")}
              />
            ) : (
              <div className="absolute inset-0 bg-black/[0.04]" />
            )}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[52%] lg:w-[34%]"
              style={{
                background:
                  "linear-gradient(to right, #f7f7f5 0%, rgba(247,247,245,0.85) 30%, transparent 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 lg:hidden"
              style={{
                background:
                  "linear-gradient(to bottom, #f7f7f5 0%, transparent 100%)",
              }}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-black/[0.06]">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-16 sm:px-10 sm:py-24 lg:px-14 xl:px-20">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
              Why KlikCollect
            </p>
            <h2 className="mt-4 max-w-xl text-[clamp(1.6rem,3.5vw,2.4rem)] font-medium tracking-tight">
              A marketplace for shops that take fulfilment seriously.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-0 border-t border-black/[0.06] sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <div className="border-b border-black/[0.06] py-8 sm:px-6 sm:py-10 lg:px-8 [&:nth-child(odd)]:sm:border-r lg:border-r lg:[&:nth-child(4n)]:border-r-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/30">
                    0{i + 1}
                  </p>
                  <h3 className="mt-3 text-[18px] font-medium tracking-tight sm:text-[20px]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-black/50">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/[0.06]">
        <div className="mx-auto grid w-full max-w-[1600px] gap-12 px-4 py-16 sm:px-10 sm:py-24 lg:grid-cols-2 lg:gap-20 lg:px-14 xl:px-20">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
              Who it&apos;s for
            </p>
            <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.1rem)] font-medium tracking-tight">
              Sellers with real products and a plan to deliver.
            </h2>
            <ul className="mt-10 divide-y divide-black/[0.06] border-y border-black/[0.06]">
              {WHO.map((line) => (
                <li
                  key={line}
                  className="py-4 text-[15px] leading-relaxed text-black/70"
                >
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
              What we look for
            </p>
            <h2 className="mt-4 text-[clamp(1.5rem,3vw,2.1rem)] font-medium tracking-tight">
              Standards that protect shoppers and good brands.
            </h2>
            <ul className="mt-10 divide-y divide-black/[0.06] border-y border-black/[0.06]">
              {LOOK_FOR.map((line) => (
                <li
                  key={line}
                  className="py-4 text-[15px] leading-relaxed text-black/70"
                >
                  {line}
                </li>
              ))}
            </ul>
            <Link
              href="/brands"
              className="mt-8 inline-flex text-[13px] font-medium underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
            >
              Browse current vendors
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="relative min-h-[42svh] w-full overflow-hidden border-t border-black/[0.06] sm:min-h-[52svh]">
        {BAND_IMAGE ? (
          <Image
            src={BAND_IMAGE}
            alt=""
            fill
            className="object-cover object-center"
            sizes="100vw"
            unoptimized={BAND_IMAGE.startsWith("http")}
          />
        ) : null}
        <div className="absolute inset-0 bg-[#f7f7f5]/55" />
        <div className="relative z-10 mx-auto flex h-full min-h-[42svh] w-full max-w-[1600px] items-end px-4 py-12 sm:min-h-[52svh] sm:px-10 sm:py-16 lg:px-14 xl:px-20">
          <Reveal>
            <p className="max-w-lg text-[clamp(1.5rem,3.5vw,2.25rem)] font-medium tracking-tight text-black">
              From neighbourhood shops to growing brands.
            </p>
          </Reveal>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-t border-black/[0.06]">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-16 sm:px-10 sm:py-24 lg:px-14 xl:px-20">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
              Process
            </p>
            <h2 className="mt-4 text-[clamp(1.5rem,3.5vw,2.25rem)] font-medium tracking-tight">
              How it works
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-0 border-t border-black/[0.06] sm:mt-16 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.08}>
                <div
                  className={`border-b border-black/[0.06] py-8 sm:border-b-0 sm:py-10 sm:pr-10 ${
                    i < STEPS.length - 1 ? "sm:border-r" : ""
                  } ${i > 0 ? "sm:pl-10" : ""}`}
                >
                  <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-black/35">
                    {step.n}
                  </p>
                  <h3 className="mt-4 text-[22px] font-medium tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-black/50">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/[0.06]">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-start justify-between gap-10 px-4 py-16 sm:flex-row sm:items-end sm:px-10 sm:py-24 lg:px-14 xl:px-20">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
              Application
            </p>
            <h2 className="mt-4 max-w-xl text-[clamp(1.85rem,4vw,2.9rem)] font-medium tracking-tight">
              Ready to tell us about your shop?
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-black/50">
              Sign in to apply. One question at a time, then track live status
              from your account. You can edit a pending application up to 3
              times.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <button
              type="button"
              onClick={() => void startApplication()}
              disabled={starting}
              className="inline-flex min-h-12 items-center bg-black px-8 text-[12px] font-medium uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {starting ? "Checking..." : "Start application"}
            </button>
          </Reveal>
        </div>
      </section>

      <SellApplicationPanel
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        onTrack={() => openSellApplicationTracker()}
      />
    </div>
  );
}
