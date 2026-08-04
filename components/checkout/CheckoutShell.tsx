"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  children: React.ReactNode;
  /** Main column (form) — on lg+, summary sits beside it */
  summary?: React.ReactNode;
  dock: React.ReactNode;
};

/** Checkout chrome: header, responsive body, sticky place-order dock. */
export default function CheckoutShell({ children, summary, dock }: Props) {
  return (
    <div className="relative min-h-[100dvh] bg-[#f7f7f5] text-black">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#f7f7f5]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link
            href="/cart"
            className="inline-flex h-11 w-11 items-center justify-center -ml-2 text-black/80 transition-opacity hover:opacity-50"
            aria-label="Back to cart"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <h1 className="flex-1 text-center text-[16px] font-semibold tracking-tight lg:text-left lg:pl-2">
            Checkout
          </h1>
          <span className="w-11 lg:hidden" aria-hidden />
        </div>
      </header>

      <div
        className={
          summary
            ? "mx-auto grid max-w-[1100px] gap-8 px-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 lg:px-8 lg:pb-12 lg:pt-10"
            : "mx-auto max-w-[640px] px-4 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-5 sm:px-6 sm:pt-8"
        }
      >
        <div className="min-w-0">{children}</div>
        {summary ? (
          <aside className="hidden min-w-0 lg:block">
            <div className="sticky top-24 space-y-6 border border-black/[0.08] bg-white/60 p-6 backdrop-blur-sm">
              {summary}
            </div>
          </aside>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-[#f7f7f5]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] lg:border-t lg:bg-[#f7f7f5]">
        <div className="mx-auto max-w-[1100px] px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          {dock}
        </div>
      </div>
    </div>
  );
}
