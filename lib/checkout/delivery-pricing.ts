/**
 * Distance-based delivery pricing for checkout.
 * Home delivery is never free. Hybrid consolidate always has a fee.
 */
import { distanceKm } from "@/lib/mapbox";

/** KES → minor units (cents) */
const BASE_HOME_MINOR = 12_000; // KES 120
const PER_KM_MINOR = 3_500; // KES 35 / km
const MIN_HOME_MINOR = 15_000; // KES 150 floor — never free
const EXTRA_STOP_MINOR = 8_000; // KES 80 per extra vendor

const BASE_HYBRID_MINOR = 10_000; // KES 100
const HYBRID_PER_KM_MINOR = 2_500; // KES 25 / km between shops
const MIN_HYBRID_MINOR = 12_000; // KES 120 floor

const AVG_SPEED_KMH = 22;
const BASE_MINUTES = 12;
const STOP_MINUTES = 6;

export type Coord = { lat: number; lng: number };

export type DeliveryQuote = {
  deliveryMinor: number;
  distanceKm: number;
  etaMinutes: number;
  breakdown: string;
};

function clampMinor(n: number, min: number) {
  return Math.max(min, Math.round(n));
}

/** Straight-line km → rough drive ETA. */
export function estimateEtaMinutes(km: number, stops = 1): number {
  const drive = (km / AVG_SPEED_KMH) * 60;
  return Math.max(15, Math.round(drive + BASE_MINUTES + Math.max(0, stops - 1) * STOP_MINUTES));
}

/**
 * Home delivery from one or more shops to the customer.
 * Fee from farthest shop + surcharge per extra stop. Never free.
 */
export function quoteHomeDelivery(
  home: Coord,
  shops: Coord[],
): DeliveryQuote {
  const withDist = shops
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map((s) => distanceKm(home, s));

  if (!withDist.length) {
    return {
      deliveryMinor: MIN_HOME_MINOR,
      distanceKm: 0,
      etaMinutes: 35,
      breakdown: "Standard same-day delivery (location pending)",
    };
  }

  const farthest = Math.max(...withDist);
  const stops = withDist.length;
  const raw =
    BASE_HOME_MINOR +
    farthest * PER_KM_MINOR +
    Math.max(0, stops - 1) * EXTRA_STOP_MINOR;
  const deliveryMinor = clampMinor(raw, MIN_HOME_MINOR);
  const etaMinutes = estimateEtaMinutes(farthest, stops);

  const parts = [
    `${farthest < 1 ? `${Math.round(farthest * 1000)} m` : `${farthest.toFixed(1)} km`} to shop`,
  ];
  if (stops > 1) parts.push(`${stops} shops`);

  return {
    deliveryMinor,
    distanceKm: farthest,
    etaMinutes,
    breakdown: parts.join(" · "),
  };
}

/**
 * Hybrid: drivers gather from all shops → one chosen collect hub.
 * Cheaper than full home delivery across many shops, never free.
 */
export function quoteHybridConsolidate(
  shops: Coord[],
  hubIndex: number,
): DeliveryQuote {
  if (!shops.length) {
    return {
      deliveryMinor: MIN_HYBRID_MINOR,
      distanceKm: 0,
      etaMinutes: 40,
      breakdown: "Consolidate to one collect point",
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
  // Single-vendor hybrid degenerates to a small consolidate fee
  if (shops.length === 1) {
    return {
      deliveryMinor: MIN_HYBRID_MINOR,
      distanceKm: 0,
      etaMinutes: 25,
      breakdown: "Ready at your chosen shop",
    };
  }

  const raw = BASE_HYBRID_MINOR + routeKm * HYBRID_PER_KM_MINOR;
  const deliveryMinor = clampMinor(raw, MIN_HYBRID_MINOR);
  const etaMinutes = estimateEtaMinutes(routeKm, shops.length);

  return {
    deliveryMinor,
    distanceKm: routeKm,
    etaMinutes,
    breakdown: `${shops.length - 1} pickups → one hub · ${routeKm.toFixed(1)} km`,
  };
}

/** Classic click & collect — customer visits shop(s); no delivery fee. */
export function quoteClassicPickup(): DeliveryQuote {
  return {
    deliveryMinor: 0,
    distanceKm: 0,
    etaMinutes: 0,
    breakdown: "You collect — no delivery fee",
  };
}
