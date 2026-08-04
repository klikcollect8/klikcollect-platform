"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeLiveStoreStatus,
  type LiveHoursInput,
} from "@/lib/store-hours-live";

type Variant = "hero" | "inline";

/** Live open/closed + Nairobi clock - compact by default in hero. */
export default function VendorLiveStatus({
  hours,
  variant = "inline",
  label,
}: {
  hours: LiveHoursInput | null;
  variant?: Variant;
  /** Branch / place label tucked into the status line */
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const status = useMemo(
    () => computeLiveStoreStatus(hours, new Date(now)),
    [hours, now],
  );

  if (variant === "hero") {
    return (
      <>
        {/* Mobile: one quiet line */}
        <p className="truncate text-[13px] text-black/45 sm:hidden">
          <span className={status.openNow ? "text-black/70" : "text-black/40"}>
            {status.statusLabel}
          </span>
          {status.countdownLabel ? (
            <>
              <span className="mx-1.5 text-black/20">·</span>
              <span>{status.countdownLabel}</span>
            </>
          ) : null}
          {label ? (
            <>
              <span className="mx-1.5 text-black/20">·</span>
              <span>{label}</span>
            </>
          ) : null}
        </p>

        {/* Desktop / tablet: full strip */}
        <div className="hidden sm:flex sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-8 sm:gap-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span
              className={`inline-block h-1.5 w-1.5 shrink-0 translate-y-[-1px] ${
                status.openNow ? "bg-black" : "bg-black/30"
              }`}
              aria-hidden
            />
            <span
              className={`text-[15px] font-medium tracking-tight ${
                status.openNow ? "text-black" : "text-black/45"
              }`}
            >
              {status.statusLabel}
            </span>
            {status.countdownLabel ? (
              <span className="text-[13px] text-black/45">
                · {status.countdownLabel}
              </span>
            ) : null}
            {label ? (
              <span className="text-[13px] text-black/40">· {label}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2.5 text-[13px] tabular-nums text-black/45 sm:justify-end">
            <span className="font-medium text-black/70">
              {status.clockWithSeconds}
            </span>
            <span className="text-black/25">·</span>
            <span>Nairobi</span>
            {status.todayRange ? (
              <>
                <span className="text-black/25">·</span>
                <span>{status.todayRange}</span>
              </>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`inline-block h-1.5 w-1.5 shrink-0 ${
            status.openNow ? "bg-black" : "bg-black/25"
          }`}
          aria-hidden
        />
        <p className="text-[clamp(1.35rem,3vw,1.75rem)] font-medium tracking-tight">
          {status.statusLabel}
        </p>
      </div>
      <p className="mt-3 text-[14px] tabular-nums text-black/45">
        {status.clockWithSeconds}
        <span className="mx-2 text-black/20">·</span>
        Nairobi
        {status.todayRange ? (
          <>
            <span className="mx-2 text-black/20">·</span>
            {status.todayRange}
          </>
        ) : null}
      </p>
      {status.countdownLabel ? (
        <p className="mt-2 text-[13px] text-black/40">
          {status.countdownLabel}
        </p>
      ) : null}
    </div>
  );
}
