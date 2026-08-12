/**
 * Road-distance delivery pricing for checkout.
 *
 * fee = max(
 *   MIN,
 *   BASE + max(0, roadKm − FREE_KM) × PER_KM + (shops − 1) × STOP_FEE
 *     + operational adjustments
 * )
 *
 * No upper cap — multi-shop stop fees always stack.
 * Home delivery is never free. Hybrid consolidate always has a fee.
 * Neighborhood zone flat fees are fallback only when routing fails.
 */
import { distanceKm } from "@/lib/mapbox";
import { fetchDirections, fetchOptimizedTrip } from "@/lib/mapbox-api";
import {
  deliveryZoneFeeMinor,
  getDeliveryZone,
} from "@/lib/checkout/delivery-zones";

/** KES major → knobs (Nairobi same-day rider economics) */
export const DELIVERY_BASE_MAJOR = 150;
export const DELIVERY_FREE_KM = 1;
export const DELIVERY_PER_KM_MAJOR = 40;
export const DELIVERY_MIN_MAJOR = 200;
export const DELIVERY_STOP_FEE_MAJOR = 80;

/** Modest operational add-ons (flat KES, never multipliers) */
export const ADJUST_PEAK_LUNCH_MAJOR = 20;
export const ADJUST_LATE_NIGHT_MAJOR = 30;
export const ADJUST_HEAVY_RAIN_MAJOR = 40;
export const ADJUST_HIGH_DEMAND_MAJOR = 25;

const AVG_SPEED_KMH = 22;
const BASE_MINUTES = 12;
const STOP_MINUTES = 6;

/** Haversine → rough road factor when Directions unavailable */
const HAVERSINE_ROAD_FACTOR = 1.35;

const NAIROBI_TZ = "Africa/Nairobi";

/** High-demand drop neighbourhoods (substring match, case-insensitive) */
const HIGH_DEMAND_AREAS = [
  "westlands",
  "cbd",
  "central business",
  "kilimani",
  "lavington",
  "karen",
  "upper hill",
  "parklands",
  "ngara",
  "river road",
];

export type Coord = { lat: number; lng: number };

export type DeliveryAdjustment = {
  id: string;
  label: string;
  amountMajor: number;
};

export type DeliveryQuote = {
  deliveryMinor: number;
  distanceKm: number;
  etaMinutes: number;
  breakdown: string;
  source?: "road" | "haversine" | "zone_fallback";
  /** Fee before operational adjustments (KES major) */
  baseMajor: number;
  shopCount: number;
  adjustments: DeliveryAdjustment[];
};

export type AdjustmentContext = {
  now?: Date;
  drop?: Coord | null;
  areaLabel?: string | null;
  /** Prefetched rain flag — avoids duplicate weather calls in caches */
  heavyRain?: boolean | null;
};

function majorToMinor(major: number): number {
  return Math.round(major * 100);
}

function emptyQuoteExtras(
  shopCount: number,
  baseMajor: number,
  adjustments: DeliveryAdjustment[] = [],
): Pick<DeliveryQuote, "baseMajor" | "shopCount" | "adjustments"> {
  return {
    baseMajor,
    shopCount: Math.max(1, shopCount),
    adjustments,
  };
}

/** Nairobi local hour 0–23 */
export function nairobiHour(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: NAIROBI_TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(h) ? h % 24 : 0;
}

/** Hour bucket for cache keys (ops add-ons change by hour window). */
export function nairobiHourBucket(now = new Date()): string {
  const h = nairobiHour(now);
  if (h >= 12 && h < 14) return "peak_lunch";
  if (h >= 21 || h < 6) return "late_night";
  return `h${h}`;
}

export function isHighDemandArea(areaLabel?: string | null): boolean {
  const t = (areaLabel || "").toLowerCase().trim();
  if (!t) return false;
  return HIGH_DEMAND_AREAS.some((a) => t.includes(a));
}

/**
 * Open-Meteo precip check near drop. Soft-fails → false.
 */
export async function fetchHeavyRainNear(
  drop: Coord | null | undefined,
): Promise<boolean> {
  if (
    !drop ||
    !Number.isFinite(drop.lat) ||
    !Number.isFinite(drop.lng)
  ) {
    return false;
  }
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${drop.lat}&longitude=${drop.lng}` +
      `&current=precipitation&timezone=Africa%2FNairobi`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as {
      current?: { precipitation?: number };
    };
    const precip = Number(json?.current?.precipitation ?? 0);
    return Number.isFinite(precip) && precip >= 2;
  } catch {
    return false;
  }
}

/**
 * Modest flat operational adjustments — never multipliers.
 */
export function resolveOperationalAdjustments(
  ctx: AdjustmentContext = {},
): DeliveryAdjustment[] {
  const now = ctx.now ?? new Date();
  const hour = nairobiHour(now);
  const out: DeliveryAdjustment[] = [];

  if (hour >= 12 && hour < 14) {
    out.push({
      id: "peak_lunch",
      label: "Peak lunch",
      amountMajor: ADJUST_PEAK_LUNCH_MAJOR,
    });
  }
  if (hour >= 21 || hour < 6) {
    out.push({
      id: "late_night",
      label: "Late night",
      amountMajor: ADJUST_LATE_NIGHT_MAJOR,
    });
  }
  if (ctx.heavyRain === true) {
    out.push({
      id: "heavy_rain",
      label: "Heavy rain",
      amountMajor: ADJUST_HEAVY_RAIN_MAJOR,
    });
  }
  if (isHighDemandArea(ctx.areaLabel)) {
    out.push({
      id: "high_demand",
      label: "High-demand area",
      amountMajor: ADJUST_HIGH_DEMAND_MAJOR,
    });
  }

  return out;
}

function applyAdjustments(
  baseMajor: number,
  adjustments: DeliveryAdjustment[],
  parts: string[],
  shopCount: number,
  distanceKm: number,
  etaMinutes: number,
  source: DeliveryQuote["source"],
): DeliveryQuote {
  const adjSum = adjustments.reduce((s, a) => s + a.amountMajor, 0);
  for (const a of adjustments) {
    parts.push(`${a.label.toLowerCase()} +${a.amountMajor}`);
  }
  const feeMajor = Math.max(DELIVERY_MIN_MAJOR, Math.round(baseMajor + adjSum));
  return {
    deliveryMinor: majorToMinor(feeMajor),
    distanceKm,
    etaMinutes,
    breakdown: parts.join(" · "),
    source,
    ...emptyQuoteExtras(shopCount, Math.round(baseMajor), adjustments),
  };
}

/** Straight-line / road km → rough drive ETA. */
export function estimateEtaMinutes(km: number, stops = 1): number {
  const drive = (km / AVG_SPEED_KMH) * 60;
  return Math.max(
    15,
    Math.round(drive + BASE_MINUTES + Math.max(0, stops - 1) * STOP_MINUTES),
  );
}

/**
 * Core formula from known road kilometers (no ops add-ons).
 */
export function quoteHomeDeliveryRoad(
  roadKm: number,
  shopCount = 1,
  source: DeliveryQuote["source"] = "road",
  adjustments: DeliveryAdjustment[] = [],
): DeliveryQuote {
  const km = Math.max(0, Number(roadKm) || 0);
  const stops = Math.max(1, Math.round(shopCount) || 1);
  const billableKm = Math.max(0, km - DELIVERY_FREE_KM);
  const baseMajor =
    DELIVERY_BASE_MAJOR +
    billableKm * DELIVERY_PER_KM_MAJOR +
    Math.max(0, stops - 1) * DELIVERY_STOP_FEE_MAJOR;
  const etaMinutes = estimateEtaMinutes(km, stops);

  const parts = [
    km < 1
      ? `${Math.round(km * 1000)} m`
      : `${km.toFixed(km < 10 ? 1 : 0)} km`,
    stops > 1 ? `${stops} stops` : "1 stop",
    `base ${DELIVERY_BASE_MAJOR}`,
  ];
  if (billableKm > 0) {
    parts.push(`+${billableKm.toFixed(1)} km × ${DELIVERY_PER_KM_MAJOR}`);
  }
  if (stops > 1) {
    parts.push(
      `+${stops - 1} extra stop${stops > 2 ? "s" : ""} × ${DELIVERY_STOP_FEE_MAJOR}`,
    );
  }

  return applyAdjustments(
    baseMajor,
    adjustments,
    parts,
    stops,
    km,
    etaMinutes,
    source,
  );
}

/**
 * Sync quote using haversine × road factor (no network).
 * Prefer quoteHomeDeliveryLive when possible.
 */
export function quoteHomeDelivery(
  home: Coord,
  shops: Coord[],
  adjustments: DeliveryAdjustment[] = [],
): DeliveryQuote {
  const withDist = shops
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map((s) => distanceKm(home, s));

  if (!withDist.length) {
    return quoteHomeDeliveryRoad(3, 1, "haversine", adjustments);
  }

  const farthest = Math.max(...withDist);
  const extraStopsKm = Math.max(0, withDist.length - 1) * 0.8;
  const roadKm = farthest * HAVERSINE_ROAD_FACTOR + extraStopsKm;
  return quoteHomeDeliveryRoad(
    roadKm,
    withDist.length,
    "haversine",
    adjustments,
  );
}

/**
 * Live quote: Mapbox road km for the driver trip (optimized multi-shop
 * pickup → home, or single shop → home) + per-stop fees + ops add-ons.
 */
export async function quoteHomeDeliveryLive(
  home: Coord,
  shops: Coord[],
  opts?: {
    zoneId?: string | null;
    areaLabel?: string | null;
    now?: Date;
    heavyRain?: boolean | null;
  },
): Promise<DeliveryQuote> {
  const validShops = shops.filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng),
  );

  let heavyRain = opts?.heavyRain;
  if (
    heavyRain == null &&
    Number.isFinite(home.lat) &&
    Number.isFinite(home.lng)
  ) {
    heavyRain = await fetchHeavyRainNear(home);
  }

  const adjustments = resolveOperationalAdjustments({
    now: opts?.now,
    drop: Number.isFinite(home.lat) ? home : null,
    areaLabel: opts?.areaLabel,
    heavyRain: heavyRain ?? false,
  });

  if (!Number.isFinite(home.lat) || !Number.isFinite(home.lng)) {
    return zoneFallbackQuote(
      opts?.zoneId,
      Math.max(1, validShops.length),
      adjustments,
    );
  }
  if (!validShops.length) {
    return zoneFallbackQuote(opts?.zoneId, 1, adjustments);
  }

  const roadKm = await measureDeliveryRoadKm(home, validShops);
  if (roadKm != null && roadKm > 0) {
    return quoteHomeDeliveryRoad(
      roadKm,
      validShops.length,
      "road",
      adjustments,
    );
  }

  const hav = quoteHomeDelivery(home, validShops, adjustments);
  if (hav.deliveryMinor > 0) return hav;

  return zoneFallbackQuote(opts?.zoneId, validShops.length, adjustments);
}

/**
 * Driver trip length in km: one shop → home, or an optimized tour of all
 * shops ending at home (Mapbox Optimization). Falls back to farthest-leg
 * directions, then null so the caller can haversine.
 */
async function measureDeliveryRoadKm(
  home: Coord,
  shops: Coord[],
): Promise<number | null> {
  if (shops.length >= 2) {
    try {
      const trip = await fetchOptimizedTrip(
        [
          ...shops.map((s) => ({ lng: s.lng, lat: s.lat })),
          { lng: home.lng, lat: home.lat },
        ],
        "driving",
        { roundtrip: false, source: "any", destination: "last" },
      );
      if (trip?.distanceM && trip.distanceM > 0) {
        return trip.distanceM / 1000;
      }
    } catch {
      /* fall through to per-shop directions */
    }
  }

  const roadKms: number[] = [];
  await Promise.all(
    shops.map(async (shop) => {
      try {
        const route = await fetchDirections(
          { lng: shop.lng, lat: shop.lat },
          { lng: home.lng, lat: home.lat },
          "driving",
          { alternatives: false },
        );
        if (route?.distanceM != null && route.distanceM > 0) {
          roadKms.push(route.distanceM / 1000);
        }
      } catch {
        /* try next */
      }
    }),
  );
  if (!roadKms.length) return null;
  // Single shop: that leg. Multi-shop without Optimization: farthest
  // shop→home plus a stop-distance estimate (0.8 km per extra stop).
  const farthest = Math.max(...roadKms);
  if (shops.length === 1) return farthest;
  return farthest + Math.max(0, shops.length - 1) * 0.8;
}

/** Compact UI line: "3.2 km · 2 stops · ~28 min". */
export function formatQuoteSummary(quote: DeliveryQuote): string {
  const parts: string[] = [];
  if (quote.distanceKm > 0) {
    parts.push(
      quote.distanceKm < 1
        ? `${Math.round(quote.distanceKm * 1000)} m`
        : `${quote.distanceKm.toFixed(quote.distanceKm < 10 ? 1 : 0)} km`,
    );
  }
  if (quote.shopCount > 1) {
    parts.push(`${quote.shopCount} stops`);
  }
  if (quote.etaMinutes > 0) {
    parts.push(`~${quote.etaMinutes} min`);
  }
  for (const a of quote.adjustments || []) {
    if (a.label && a.amountMajor) {
      parts.push(`${a.label} +${a.amountMajor}`);
    }
  }
  return parts.join(" · ");
}

function zoneFallbackQuote(
  zoneId: string | null | undefined,
  shopCount: number,
  adjustments: DeliveryAdjustment[] = [],
): DeliveryQuote {
  const stops = Math.max(1, shopCount);
  const zone = getDeliveryZone(zoneId || undefined);
  if (zone) {
    const stopExtra = Math.max(0, stops - 1) * DELIVERY_STOP_FEE_MAJOR;
    const baseMajor = zone.fee + stopExtra;
    const parts = [`Zone rate · ${zone.label}`];
    if (stops > 1) parts.push(`${stops} shops`);
    return applyAdjustments(
      baseMajor,
      adjustments,
      parts,
      stops,
      0,
      45,
      "zone_fallback",
    );
  }
  const baseMajor =
    (deliveryZoneFeeMinor("flat_rate") || majorToMinor(DELIVERY_MIN_MAJOR)) /
    100;
  return applyAdjustments(
    baseMajor,
    adjustments,
    ["Standard same-day delivery (location pending)"],
    stops,
    0,
    45,
    "zone_fallback",
  );
}

/**
 * Hybrid: drivers gather from all shops → one chosen collect hub.
 */
export function quoteHybridConsolidate(
  shops: Coord[],
  hubIndex: number,
): DeliveryQuote {
  const MIN_HYBRID_MAJOR = 120;
  const BASE_HYBRID_MAJOR = 100;
  const HYBRID_PER_KM_MAJOR = 25;

  if (!shops.length) {
    return {
      deliveryMinor: majorToMinor(MIN_HYBRID_MAJOR),
      distanceKm: 0,
      etaMinutes: 40,
      breakdown: "Consolidate to one collect point",
      source: "haversine",
      ...emptyQuoteExtras(1, MIN_HYBRID_MAJOR),
    };
  }
  const hub = shops[Math.min(Math.max(0, hubIndex), shops.length - 1)]!;
  let routeKm = 0;
  for (let i = 0; i < shops.length; i++) {
    if (i === hubIndex) continue;
    const s = shops[i]!;
    if (!Number.isFinite(s.lat) || !Number.isFinite(hub.lat)) continue;
    routeKm += distanceKm(s, hub);
  }
  if (shops.length === 1) {
    return {
      deliveryMinor: majorToMinor(MIN_HYBRID_MAJOR),
      distanceKm: 0,
      etaMinutes: 25,
      breakdown: "Ready at your chosen shop",
      source: "haversine",
      ...emptyQuoteExtras(1, MIN_HYBRID_MAJOR),
    };
  }

  const raw = BASE_HYBRID_MAJOR + routeKm * HYBRID_PER_KM_MAJOR;
  const feeMajor = Math.max(MIN_HYBRID_MAJOR, Math.round(raw));
  const etaMinutes = estimateEtaMinutes(routeKm, shops.length);

  return {
    deliveryMinor: majorToMinor(feeMajor),
    distanceKm: routeKm,
    etaMinutes,
    breakdown: `${shops.length - 1} pickups → one hub · ${routeKm.toFixed(1)} km`,
    source: "haversine",
    ...emptyQuoteExtras(shops.length, feeMajor),
  };
}

/** Classic click & collect — customer visits shop(s); no delivery fee. */
export function quoteClassicPickup(): DeliveryQuote {
  return {
    deliveryMinor: 0,
    distanceKm: 0,
    etaMinutes: 0,
    breakdown: "You collect — no delivery fee",
    source: "road",
    ...emptyQuoteExtras(1, 0),
  };
}
