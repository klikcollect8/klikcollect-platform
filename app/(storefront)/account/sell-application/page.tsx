"use client";

import { useEffect } from "react";
import Link from "next/link";
import { openSellApplicationTracker } from "@/components/SellApplicationTrackerPanel";

export default function AccountSellApplicationPage() {
  useEffect(() => {
    openSellApplicationTracker();
  }, []);

  return (
    <div className="space-y-10 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Sell application
        </p>
        <h1 className="mt-3 text-[clamp(1.6rem,3vw,2rem)] font-medium tracking-tight">
          Live tracking
        </h1>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-black/45">
          Status opens as a full-screen popup - the same language as apply and
          notifications. Reopen anytime below.
        </p>
      </div>

      <button
        type="button"
        onClick={() => openSellApplicationTracker()}
        className="inline-flex h-12 items-center justify-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
      >
        Open tracking
      </button>

      <Link
        href="/sell"
        className="block text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
      >
        Back to sell page
      </Link>
    </div>
  );
}
