"use client";

import { cn } from "@/lib/utils";

type Props = {
  /** m/s from GPS; null when unknown / stationary */
  speedMps: number | null;
  className?: string;
};

/** Circular speed readout (km/h) for active navigation. */
export function Speedometer({ speedMps, className }: Props) {
  const kmh =
    speedMps != null && Number.isFinite(speedMps)
      ? Math.max(0, Math.round(speedMps * 3.6))
      : 0;

  return (
    <div
      className={cn(
        "flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-[3px] border-white bg-black/90 text-white shadow-lg backdrop-blur-md",
        className,
      )}
      aria-label={`Speed ${kmh} kilometers per hour`}
    >
      <span className="text-[26px] font-semibold tabular-nums leading-none tracking-tight">
        {kmh}
      </span>
      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/55">
        km/h
      </span>
    </div>
  );
}
