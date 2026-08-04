"use client";

import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  formatSlotLabel,
  sameDaySlots,
  todayDateString,
  type DayWindow,
} from "@/lib/checkout/same-day-slots";

export type TimingMode = "asap" | "schedule";

type Props = {
  window: DayWindow;
  mode: TimingMode;
  time: string;
  etaMinutes?: number;
  onModeChange: (mode: TimingMode) => void;
  onChange: (next: { date: string; time: string; mode: TimingMode }) => void;
  fulfilment?: "pickup" | "delivery";
};

/**
 * Same-day only — ASAP or pick an hour within today's working hours.
 */
export default function SameDayTiming({
  window,
  mode,
  time,
  etaMinutes = 35,
  onModeChange,
  onChange,
  fulfilment = "delivery",
}: Props) {
  const isDelivery = fulfilment === "delivery";
  const today = todayDateString();
  const slots = useMemo(() => sameDaySlots(window), [window]);

  useEffect(() => {
    if (mode === "asap") {
      const first = slots[0] || time || "12:00";
      if (time !== first) onChange({ date: today, time: first, mode: "asap" });
      return;
    }
    if (time && !slots.includes(time) && slots[0]) {
      onChange({ date: today, time: slots[0], mode: "schedule" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, slots.join(","), today]);

  const asapLabel = window.isClosed
    ? "Closed today"
    : isDelivery
      ? `About ${etaMinutes} min`
      : slots[0]
        ? `Ready from ${formatSlotLabel(slots[0])}`
        : "No slots left today";

  return (
    <section className="mt-10">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
        Today only
      </p>
      <h3 className="mt-2 text-[1.15rem] font-medium tracking-tight">
        {isDelivery ? "When should we deliver?" : "When will you collect?"}
      </h3>
      <p className="mt-1.5 text-[13px] text-black/40">
        {window.isClosed
          ? "This shop is closed today — try another collect point or shop."
          : `Working hours ${window.openTime} – ${window.closeTime}`}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={window.isClosed || !slots.length}
          onClick={() => {
            onModeChange("asap");
            onChange({
              date: today,
              time: slots[0] || time,
              mode: "asap",
            });
          }}
          className={cn(
            "px-4 py-5 text-left transition-colors disabled:opacity-35",
            mode === "asap"
              ? "bg-black text-white"
              : "bg-black/[0.03] text-black hover:bg-black/[0.06]",
          )}
        >
          <span className="block text-[14px] font-medium">As soon as possible</span>
          <span
            className={cn(
              "mt-1.5 block text-[12px] leading-snug",
              mode === "asap" ? "text-white/65" : "text-black/40",
            )}
          >
            {asapLabel}
          </span>
        </button>
        <button
          type="button"
          disabled={window.isClosed || !slots.length}
          onClick={() => onModeChange("schedule")}
          className={cn(
            "px-4 py-5 text-left transition-colors disabled:opacity-35",
            mode === "schedule"
              ? "bg-black text-white"
              : "bg-black/[0.03] text-black hover:bg-black/[0.06]",
          )}
        >
          <span className="block text-[14px] font-medium">Choose a time</span>
          <span
            className={cn(
              "mt-1.5 block text-[12px] leading-snug",
              mode === "schedule" ? "text-white/65" : "text-black/40",
            )}
          >
            Today&apos;s hours
          </span>
        </button>
      </div>

      {mode === "schedule" && slots.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() =>
                onChange({ date: today, time: slot, mode: "schedule" })
              }
              className={cn(
                "min-h-10 px-3.5 text-[13px] transition-colors",
                time === slot
                  ? "bg-black text-white"
                  : "bg-black/[0.04] text-black/70 hover:bg-black/[0.08]",
              )}
            >
              {formatSlotLabel(slot)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
