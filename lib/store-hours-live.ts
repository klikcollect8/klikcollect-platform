/** Client-side Nairobi store hours - live open/closed + clock. */

export type LiveDayHours = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type LiveHolidayHours = {
  date: string;
  label: string;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type LiveHoursInput = {
  weekly: LiveDayHours[];
  holidays?: LiveHolidayHours[];
};

export type LiveStoreStatus = {
  openNow: boolean;
  clock: string;
  clockWithSeconds: string;
  weekday: string;
  dateLabel: string;
  todayRange: string | null;
  statusLabel: string;
  detailLabel: string;
  countdownLabel: string | null;
  dayOfWeek: number;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function nairobiParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = map[get("weekday")] ?? now.getDay();
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  const minutes = hour * 60 + minute;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    dayOfWeek,
    hour,
    minute,
    second,
    minutes,
    date,
    clock: `${get("hour")}:${get("minute")}`,
    clockWithSeconds: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function parseHm(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function formatHm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatCountdown(totalSeconds: number): string | null {
  if (totalSeconds <= 0) return null;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return "under a minute";
}

function nextOpen(
  weekly: LiveDayHours[],
  fromDay: number,
  fromMinutes: number,
): { dayOfWeek: number; open: number } | null {
  for (let offset = 0; offset < 8; offset++) {
    const d = (fromDay + offset) % 7;
    const day = weekly.find((w) => w.dayOfWeek === d);
    if (!day || day.isClosed) continue;
    const open = parseHm(day.openTime);
    if (open == null) continue;
    if (offset === 0 && open <= fromMinutes) continue;
    return { dayOfWeek: d, open };
  }
  return null;
}

export function computeLiveStoreStatus(
  input: LiveHoursInput | null | undefined,
  now = new Date(),
): LiveStoreStatus {
  const n = nairobiParts(now);
  const weekday = DAY_NAMES[n.dayOfWeek];
  const dateLabel = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
  }).format(now);

  const base = {
    clock: n.clock,
    clockWithSeconds: n.clockWithSeconds,
    weekday,
    dateLabel,
    dayOfWeek: n.dayOfWeek,
  };

  if (!input?.weekly?.length) {
    return {
      ...base,
      openNow: false,
      todayRange: null,
      statusLabel: "Hours unavailable",
      detailLabel: "Opening times not published",
      countdownLabel: null,
    };
  }

  const holiday = (input.holidays || []).find((h) => h.date === n.date);
  let open: number | null = null;
  let close: number | null = null;
  let closedDay = false;
  let holidayLabel: string | null = null;

  if (holiday) {
    holidayLabel = holiday.label;
    closedDay = holiday.isClosed;
    open = parseHm(holiday.openTime);
    close = parseHm(holiday.closeTime);
  } else {
    const day = input.weekly.find((d) => d.dayOfWeek === n.dayOfWeek);
    closedDay = !day || day.isClosed;
    open = day ? parseHm(day.openTime) : null;
    close = day ? parseHm(day.closeTime) : null;
  }

  const todayRange =
    !closedDay && open != null && close != null
      ? `${formatHm(open)}-${formatHm(close)}`
      : null;

  const openNow =
    !closedDay &&
    open != null &&
    close != null &&
    n.minutes >= open &&
    n.minutes < close;

  const secondsNow = n.minutes * 60 + n.second;

  let countdownLabel: string | null = null;
  if (openNow && close != null) {
    const left = close * 60 - secondsNow;
    const fmt = formatCountdown(left);
    countdownLabel = fmt ? `Closes in ${fmt}` : null;
  } else if (!closedDay && open != null && n.minutes < open) {
    const until = open * 60 - secondsNow;
    const fmt = formatCountdown(until);
    countdownLabel = fmt ? `Opens in ${fmt}` : null;
  } else {
    const nxt = nextOpen(input.weekly, n.dayOfWeek, n.minutes);
    if (nxt) {
      const label =
        nxt.dayOfWeek === n.dayOfWeek
          ? `Opens at ${formatHm(nxt.open)}`
          : `Opens ${DAY_NAMES[nxt.dayOfWeek]} ${formatHm(nxt.open)}`;
      countdownLabel = label;
    }
  }

  const statusLabel = openNow ? "Open now" : "Closed";
  const detailLabel = holidayLabel
    ? openNow
      ? `${holidayLabel} · ${todayRange}`
      : `${holidayLabel} · Closed`
    : openNow
      ? `Today ${todayRange}`
      : closedDay
        ? `${weekday} · Closed`
        : todayRange
          ? `${weekday} · ${todayRange}`
          : `${weekday} · Closed`;

  return {
    ...base,
    openNow,
    todayRange,
    statusLabel,
    detailLabel,
    countdownLabel,
  };
}
