"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckoutShellStep = {
  id: string;
  label: string;
};

type Props = {
  children: React.ReactNode;
  /** Main column (form) — on lg+, summary sits beside it */
  summary?: React.ReactNode;
  /** Collapsible summary shown above the form on small screens */
  mobileSummary?: React.ReactNode;
  dock: React.ReactNode;
  /** Named steps for the progress rail */
  steps?: CheckoutShellStep[];
  stepIndex?: number;
  flowLabel?: string;
};

/** Checkout chrome: sticky header + timeline, sticky summary (cart-style), dock. */
export default function CheckoutShell({
  children,
  summary,
  mobileSummary,
  dock,
  steps = [],
  stepIndex = 0,
  flowLabel,
}: Props) {
  const safeIndex = Math.max(
    0,
    Math.min(stepIndex, Math.max(steps.length - 1, 0)),
  );

  return (
    <div className="relative min-h-[100dvh] bg-[#f7f7f5] text-black">
      {/* Sticky checkout bar + compact timeline */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-[#f7f7f5]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link
            href="/cart"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center -ml-2 text-black/80 transition-opacity hover:opacity-50"
            aria-label="Back to bag"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[16px] font-semibold tracking-tight sm:text-[17px]">
                Checkout
              </h1>
              {flowLabel ? (
                <span className="hidden truncate text-[12px] text-black/40 sm:inline">
                  · {flowLabel}
                </span>
              ) : null}
            </div>
          </div>
          {steps.length > 0 ? (
            <p className="shrink-0 text-[12px] tabular-nums text-black/40 sm:hidden">
              {safeIndex + 1}/{steps.length}
            </p>
          ) : (
            <p className="hidden text-[11px] uppercase tracking-[0.16em] text-black/35 sm:block">
              Secure
            </p>
          )}
        </div>

        {steps.length > 0 ? (
          <nav
            aria-label="Checkout progress"
            className="mx-auto max-w-[1120px] px-4 pb-3 sm:px-6 lg:hidden lg:px-8"
          >
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <p className="font-medium text-black">
                {steps[safeIndex]?.label}
              </p>
              <p className="hidden tabular-nums text-black/40 sm:block">
                {safeIndex + 1} / {steps.length}
              </p>
            </div>
            <div className="mt-2 flex gap-1">
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "h-0.5 flex-1 transition-colors",
                    i <= safeIndex ? "bg-black" : "bg-black/10",
                  )}
                  aria-hidden
                />
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <div
        className={
          summary
            ? "mx-auto grid max-w-[1120px] gap-6 px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom,0px))] pt-6 sm:gap-8 sm:px-6 sm:pb-[calc(8rem+env(safe-area-inset-bottom,0px))] sm:pt-8 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pb-14 lg:pt-10"
            : "mx-auto max-w-[640px] px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6 sm:pt-8"
        }
      >
        <div className="min-w-0 space-y-6 sm:space-y-8 lg:col-span-8">
          {mobileSummary ? (
            <div className="sticky top-[6.5rem] z-20 -mx-4 border-b border-black/[0.06] bg-[#f7f7f5]/95 px-4 py-3.5 backdrop-blur-md sm:top-[7.25rem] sm:-mx-0 sm:border sm:border-black/10 sm:bg-[#f7f7f5] sm:px-4 sm:py-4 sm:backdrop-blur-none lg:hidden">
              {mobileSummary}
            </div>
          ) : null}
          <div className="min-w-0">{children}</div>
        </div>

        {summary ? (
          <aside className="hidden min-w-0 lg:col-span-4 lg:block">
            {/* Match cart: sticky top-28 */}
            <div className="sticky top-28 space-y-6">
              {steps.length > 0 ? (
                <nav
                  aria-label="Checkout steps"
                  className="border border-black/10 bg-[#f7f7f5] p-6"
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">
                    Timeline
                  </p>
                  <ol className="mt-4 space-y-0">
                    {steps.map((s, i) => {
                      const done = i < safeIndex;
                      const current = i === safeIndex;
                      return (
                        <li key={s.id} className="flex gap-3">
                          <div className="flex w-6 flex-col items-center">
                            <span
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-medium tabular-nums",
                                current
                                  ? "bg-black text-white"
                                  : done
                                    ? "bg-black/10 text-black/70"
                                    : "bg-black/[0.04] text-black/35",
                              )}
                              aria-current={current ? "step" : undefined}
                            >
                              {done ? "✓" : i + 1}
                            </span>
                            {i < steps.length - 1 ? (
                              <span
                                className={cn(
                                  "my-1 w-px flex-1 min-h-[14px]",
                                  i < safeIndex ? "bg-black/25" : "bg-black/10",
                                )}
                                aria-hidden
                              />
                            ) : null}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 pb-3 pt-0.5",
                              current
                                ? "text-black"
                                : done
                                  ? "text-black/55"
                                  : "text-black/30",
                            )}
                          >
                            <p
                              className={cn(
                                "text-[14px]",
                                current ? "font-semibold" : "font-medium",
                              )}
                            >
                              {s.label}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </nav>
              ) : null}

              <div className="border border-black/10 bg-[#f7f7f5] p-6 sm:p-8">
                {summary}
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-[#f7f7f5]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto max-w-[1120px] px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
          {dock}
        </div>
      </div>
    </div>
  );
}
