"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#f7f7f5] px-6 text-center text-black">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/40">
        Something went wrong
      </p>
      <h1 className="mt-3 text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
        This page hit a snag
      </h1>
      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-black/50">
        You can try again, or head back to the shop. Your bag is still on this
        device.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center bg-black px-6 text-[12px] font-medium uppercase tracking-[0.14em] text-white"
        >
          Try again
        </button>
        <Link
          href="/shop"
          className="inline-flex min-h-11 items-center border border-black px-6 text-[12px] font-medium uppercase tracking-[0.14em]"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
