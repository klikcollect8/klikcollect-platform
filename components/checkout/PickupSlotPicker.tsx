"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import ThemeSelect from "@/components/ui/ThemeSelect";

const HOURS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

export type TimingMode = "asap" | "schedule";

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function formatSlotLabel(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return format(d, "h:mm a");
}

export function slotsForDate(date: string, now = new Date()): string[] {
  const day = parseISO(date);
  const isToday = isSameDay(day, now);
  const cutoff = now.getTime() + 45 * 60 * 1000;
  const open: string[] = [];
  for (const h of HOURS) {
    if (!isToday) {
      open.push(h);
      continue;
    }
    const [hh, mm] = h.split(":").map(Number);
    const slot = new Date(day);
    slot.setHours(hh, mm, 0, 0);
    if (slot.getTime() >= cutoff) open.push(h);
  }
  return open;
}

export function buildPickupDays(now = new Date()) {
  const todaySlots = slotsForDate(dayKey(now), now);
  const startOffset = todaySlots.length > 0 ? 0 : 1;
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startOfDay(now), startOffset + i);
    const today = isSameDay(d, now);
    const tomorrow = isSameDay(d, addDays(now, 1));
    return {
      date: dayKey(d),
      label: today
        ? `Today · ${format(d, "d MMM")}`
        : tomorrow
          ? `Tomorrow · ${format(d, "d MMM")}`
          : format(d, "EEE d MMM"),
    };
  });
}

export function firstAvailablePickup(now = new Date()): {
  date: string;
  time: string;
} | null {
  for (const day of buildPickupDays(now)) {
    const slots = slotsForDate(day.date, now);
    if (slots[0]) return { date: day.date, time: slots[0] };
  }
  return null;
}

type Props = {
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  /** pickup = collect wording; delivery = drop-off wording */
  fulfilment?: "pickup" | "delivery";
};

/**
 * Timing — ASAP vs Schedule (Panera / Grill'd / Grab pattern).
 */
export default function PickupSlotPicker({
  date,
  time,
  onChange,
  fulfilment = "pickup",
}: Props) {
  const isDelivery = fulfilment === "delivery";
  const asap = useMemo(() => firstAvailablePickup(), []);
  const days = useMemo(() => buildPickupDays(), []);
  const [mode, setMode] = useState<TimingMode>("asap");

  const slots = useMemo(
    () => (date ? slotsForDate(date) : []).map((t) => ({
      value: t,
      label: formatSlotLabel(t),
    })),
    [date],
  );

  const asapLabel = asap
    ? isDelivery
      ? `Earliest ${formatSlotLabel(asap.time)}`
      : `Ready from ${formatSlotLabel(asap.time)}`
    : "No slots available";

  const summary =
    mode === "asap"
      ? asapLabel
      : date && time
        ? `${days.find((d) => d.date === date)?.label ?? date} · ${formatSlotLabel(time)}`
        : "Choose a time";

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
          {isDelivery ? "Delivery time" : "Collect"}
        </p>
        <h2 className="mt-2 text-[clamp(1.35rem,2.8vw,1.65rem)] font-medium tracking-tight">
          {isDelivery ? "When should we deliver?" : "When will you collect?"}
        </h2>
        <p className="mt-2 text-[13px] text-black/40">{summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setMode("asap");
            if (asap) onChange(asap);
          }}
          className={cn(
            "px-4 py-5 text-left transition-colors",
            mode === "asap"
              ? "bg-black text-white"
              : "bg-black/[0.03] text-black hover:bg-black/[0.06]",
          )}
        >
          <span className="block text-[14px] font-medium">ASAP</span>
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
          onClick={() => setMode("schedule")}
          className={cn(
            "px-4 py-5 text-left transition-colors",
            mode === "schedule"
              ? "bg-black text-white"
              : "bg-black/[0.03] text-black hover:bg-black/[0.06]",
          )}
        >
          <span className="block text-[14px] font-medium">Schedule</span>
          <span
            className={cn(
              "mt-1.5 block text-[12px] leading-snug",
              mode === "schedule" ? "text-white/65" : "text-black/40",
            )}
          >
            Pick a day &amp; time
          </span>
        </button>
      </div>

      {mode === "schedule" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-[12px] text-black/40">Day</span>
            <ThemeSelect
              value={date}
              onValueChange={(nextDate) => {
                const nextSlots = slotsForDate(nextDate);
                const keep =
                  nextSlots.find((s) => s === time) ?? nextSlots[0] ?? "";
                onChange({ date: nextDate, time: keep });
              }}
              options={days.map((d) => ({ value: d.date, label: d.label }))}
              placeholder="Select day"
              fullWidth
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[12px] text-black/40">Time</span>
            <ThemeSelect
              value={time}
              onValueChange={(nextTime) =>
                onChange({ date, time: nextTime })
              }
              options={slots}
              placeholder="Select time"
              fullWidth
              disabled={!date || slots.length === 0}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
