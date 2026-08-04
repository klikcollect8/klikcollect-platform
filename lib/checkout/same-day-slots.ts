/**
 * Same-day only timing slots from vendor working hours.
 */
import { format, isSameDay, parseISO, startOfDay } from "date-fns";
import type { PublicDayHours, PublicHolidayHours } from "@/lib/vendor-storefront";

export type DayWindow = {
  openTime: string; // HH:mm
  closeTime: string;
  isClosed: boolean;
};

const DEFAULT_WINDOW: DayWindow = {
  openTime: "09:00",
  closeTime: "18:00",
  isClosed: false,
};

function todayKey(now = new Date()) {
  return format(now, "yyyy-MM-dd");
}

function parseHm(hm: string, day: Date): Date {
  const [hh, mm] = hm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}

/** Resolve today's open window from weekly + holiday rows. */
export function resolveTodayWindow(
  weekly: PublicDayHours[] | undefined,
  holidays: PublicHolidayHours[] | undefined,
  now = new Date(),
): DayWindow {
  const key = todayKey(now);
  const holiday = holidays?.find((h) => h.date === key);
  if (holiday) {
    if (holiday.isClosed) {
      return { openTime: "09:00", closeTime: "18:00", isClosed: true };
    }
    return {
      openTime: holiday.openTime || "09:00",
      closeTime: holiday.closeTime || "18:00",
      isClosed: false,
    };
  }
  const dow = now.getDay();
  const row = weekly?.find((d) => d.dayOfWeek === dow);
  if (!row) return { ...DEFAULT_WINDOW };
  if (row.isClosed) {
    return { openTime: "09:00", closeTime: "18:00", isClosed: true };
  }
  return {
    openTime: row.openTime || "09:00",
    closeTime: row.closeTime || "18:00",
    isClosed: false,
  };
}

/** Intersect multiple windows (latest open, earliest close). */
export function intersectWindows(windows: DayWindow[]): DayWindow {
  if (!windows.length) return { ...DEFAULT_WINDOW };
  if (windows.some((w) => w.isClosed)) {
    return { openTime: "09:00", closeTime: "18:00", isClosed: true };
  }
  const openTimes = windows.map((w) => w.openTime);
  const closeTimes = windows.map((w) => w.closeTime);
  const openTime = openTimes.sort().at(-1) || "09:00";
  const closeTime = closeTimes.sort()[0] || "18:00";
  if (openTime >= closeTime) {
    return { openTime, closeTime, isClosed: true };
  }
  return { openTime, closeTime, isClosed: false };
}

/**
 * Hourly slots for today only, starting after now + leadMinutes.
 * Returns empty if shop closed or no remaining hours.
 */
export function sameDaySlots(
  window: DayWindow,
  now = new Date(),
  leadMinutes = 45,
): string[] {
  if (window.isClosed) return [];
  const day = startOfDay(now);
  const open = parseHm(window.openTime, day);
  const close = parseHm(window.closeTime, day);
  const earliest = new Date(now.getTime() + leadMinutes * 60 * 1000);

  const slots: string[] = [];
  const cursor = new Date(open);
  // Snap to next full hour at/after open
  if (cursor.getMinutes() > 0) {
    cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
  }
  while (cursor.getTime() + 30 * 60 * 1000 <= close.getTime()) {
    if (cursor.getTime() >= earliest.getTime()) {
      slots.push(format(cursor, "HH:mm"));
    }
    cursor.setHours(cursor.getHours() + 1);
  }
  return slots;
}

export function todayDateString(now = new Date()) {
  return todayKey(now);
}

export function formatSlotLabel(time: string) {
  const [hh, mm] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return format(d, "h:mm a");
}

export function isTodayDate(date: string, now = new Date()) {
  try {
    return isSameDay(parseISO(date), now);
  } catch {
    return false;
  }
}
