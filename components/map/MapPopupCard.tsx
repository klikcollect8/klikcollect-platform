"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MapPopupCardProps = {
  title: string;
  subtitle?: string;
  meta?: string[];
  actions?: ReactNode;
  className?: string;
  accent?: string;
  children?: ReactNode;
};

/** Compact info window content for map selections. */
export default function MapPopupCard({
  title,
  subtitle,
  meta = [],
  actions,
  className,
  accent = "#2f6b4f",
  children,
}: MapPopupCardProps) {
  return (
    <div
      className={cn(
        "min-w-[220px] max-w-[300px] rounded-2xl border border-black/8 bg-white p-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight text-black">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] leading-snug text-black/50">
              {subtitle}
            </p>
          ) : null}
          {meta.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {meta.map((m) => (
                <span
                  key={m}
                  className="rounded-lg bg-black/[0.04] px-2 py-1 text-[11px] font-medium text-black/55"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : null}
          {children}
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
