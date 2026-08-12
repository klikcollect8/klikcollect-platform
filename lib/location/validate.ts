/**
 * Coordinate validation shared by client UI and API routes.
 *
 * Server routes use these to reject/flag client-supplied coordinates
 * (never trust `Number.isFinite` alone). UI uses them to warn — manual
 * entry is never hard-blocked, only surfaced as low confidence.
 */

/** Kenya bounding box (approx, generous). */
export const KENYA_BBOX = {
  west: 33.5,
  south: -4.9,
  east: 42.0,
  north: 4.7,
} as const;

/** Nairobi metro bounding box (matches the search bias box in lib/mapbox-api). */
export const NAIROBI_METRO_BBOX = {
  west: 36.55,
  south: -1.55,
  east: 37.15,
  north: -1.05,
} as const;

export function isValidLatLng(
  lat: unknown,
  lng: unknown,
): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function isInKenyaBbox(lat: number, lng: number): boolean {
  return (
    isValidLatLng(lat, lng) &&
    lat >= KENYA_BBOX.south &&
    lat <= KENYA_BBOX.north &&
    lng >= KENYA_BBOX.west &&
    lng <= KENYA_BBOX.east
  );
}

export function isInNairobiMetro(lat: number, lng: number): boolean {
  return (
    isValidLatLng(lat, lng) &&
    lat >= NAIROBI_METRO_BBOX.south &&
    lat <= NAIROBI_METRO_BBOX.north &&
    lng >= NAIROBI_METRO_BBOX.west &&
    lng <= NAIROBI_METRO_BBOX.east
  );
}

/** Nairobi CBD default centre — a pin exactly here is usually a placeholder. */
const NAIROBI_CENTER_LAT = -1.2921;
const NAIROBI_CENTER_LNG = 36.8219;

/**
 * Heuristics for coordinates that are technically valid but almost certainly
 * wrong: null island, exact 0 axes, the exact default map centre, or a point
 * far outside Kenya for a Kenya-only marketplace.
 */
export function isSuspiciousCoordinate(lat: number, lng: number): boolean {
  if (!isValidLatLng(lat, lng)) return true;
  // Null island / zeroed axes
  if (lat === 0 && lng === 0) return true;
  if (lat === 0 || lng === 0) return true;
  // Exact default centre (seed/placeholder)
  if (
    Math.abs(lat - NAIROBI_CENTER_LAT) < 1e-9 &&
    Math.abs(lng - NAIROBI_CENTER_LNG) < 1e-9
  ) {
    return true;
  }
  return false;
}

export type CoordinateCheck = {
  ok: boolean;
  /** Machine-readable reason when not ok / flagged */
  reason:
    | "valid"
    | "invalid_range"
    | "suspicious"
    | "outside_kenya"
    | "outside_nairobi_metro";
  /** Soft flag — coordinate is usable but should be surfaced for review */
  flagged: boolean;
};

/**
 * Full server-side check. Invalid ranges are hard failures; suspicious or
 * out-of-Kenya coordinates are flagged (callers decide reject vs warn).
 */
export function checkCoordinate(lat: unknown, lng: unknown): CoordinateCheck {
  if (!isValidLatLng(lat, lng) || typeof lng !== "number") {
    return { ok: false, reason: "invalid_range", flagged: true };
  }
  const la = lat as number;
  const ln = lng as number;
  if (isSuspiciousCoordinate(la, ln)) {
    return { ok: false, reason: "suspicious", flagged: true };
  }
  if (!isInKenyaBbox(la, ln)) {
    return { ok: true, reason: "outside_kenya", flagged: true };
  }
  if (!isInNairobiMetro(la, ln)) {
    return { ok: true, reason: "outside_nairobi_metro", flagged: true };
  }
  return { ok: true, reason: "valid", flagged: false };
}

/** Distance in metres between two coordinates (haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
