/**
 * Location provider abstraction.
 *
 * Wraps the existing Mapbox helpers (lib/mapbox-api.ts) behind a stable,
 * provider-agnostic interface and adds the infrastructure the raw helpers
 * lack:
 *
 * - in-memory TTL caching (reverse geocodes, routes, matrices, isochrones)
 * - AbortSignal passthrough / cancellation
 * - a latest-wins sequencer so stale async results never overwrite newer ones
 * - lightweight success/latency/cache analytics counters
 *
 * Mapbox stays the sole implementation; swapping providers later only means
 * re-implementing this module.
 */

import {
  fetchDirections,
  fetchIsochrone,
  fetchTravelMatrix,
  matchTraceToRoads,
  retrieveAddress,
  reverseGeocode as mapboxReverseGeocode,
  searchBoxForward,
  searchBoxReverse,
  suggestAddresses,
  type AddressSuggestion,
  type DirectionsResult,
  type LngLat,
  type MatrixResult,
  type TravelProfile,
} from "@/lib/mapbox-api";
import {
  confidenceFromProvider,
  type CanonicalLocation,
  type LocationConfidence,
} from "@/lib/location/types";
import { isValidLatLng } from "@/lib/location/validate";

/* -------------------------------------------------------------------------- */
/* Cache                                                                      */
/* -------------------------------------------------------------------------- */

type CacheEntry<T> = { value: T; expiresAt: number };

const CACHE_MAX_ENTRIES = 400;
const cache = new Map<string, CacheEntry<unknown>>();

const TTL = {
  reverseGeocodeMs: 10 * 60_000,
  forwardSearchMs: 2 * 60_000,
  routeMs: 2 * 60_000,
  matrixMs: 2 * 60_000,
  isochroneMs: 5 * 60_000,
} as const;

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Drop oldest entry (Map preserves insertion order)
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Round to ~1m precision so nearby pins share reverse-geocode cache hits. */
function coordKey(lng: number, lat: number) {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

/* -------------------------------------------------------------------------- */
/* Analytics counters                                                         */
/* -------------------------------------------------------------------------- */

export type LocationOpName =
  | "search"
  | "resolve_place"
  | "reverse_geocode"
  | "route"
  | "matrix"
  | "match_route"
  | "isochrone";

type OpStats = {
  attempts: number;
  successes: number;
  failures: number;
  cacheHits: number;
  totalLatencyMs: number;
};

const stats = new Map<LocationOpName, OpStats>();

function statFor(op: LocationOpName): OpStats {
  let s = stats.get(op);
  if (!s) {
    s = { attempts: 0, successes: 0, failures: 0, cacheHits: 0, totalLatencyMs: 0 };
    stats.set(op, s);
  }
  return s;
}

function recordOp(
  op: LocationOpName,
  outcome: "success" | "failure" | "cache_hit",
  latencyMs = 0,
) {
  const s = statFor(op);
  if (outcome === "cache_hit") {
    s.cacheHits += 1;
    return;
  }
  s.attempts += 1;
  s.totalLatencyMs += latencyMs;
  if (outcome === "success") s.successes += 1;
  else s.failures += 1;
}

export type LocationProviderStats = Record<
  LocationOpName,
  OpStats & { avgLatencyMs: number; successRate: number }
>;

/** Snapshot of in-session provider metrics (for diagnostics/analytics). */
export function getLocationProviderStats(): Partial<LocationProviderStats> {
  const out: Partial<LocationProviderStats> = {};
  for (const [op, s] of stats.entries()) {
    out[op] = {
      ...s,
      avgLatencyMs: s.attempts ? Math.round(s.totalLatencyMs / s.attempts) : 0,
      successRate: s.attempts ? s.successes / s.attempts : 1,
    };
  }
  return out;
}

/* --------------------------- best-effort flushing -------------------------- */

/** Counters already reported to the server (flushes send only the delta). */
const flushed = new Map<LocationOpName, OpStats>();
let flushTimer: ReturnType<typeof setInterval> | null = null;
const FLUSH_INTERVAL_MS = 60_000;

function computeDeltas(): Record<string, OpStats> | null {
  const deltas: Record<string, OpStats> = {};
  let any = false;
  for (const [op, s] of stats.entries()) {
    const prev = flushed.get(op) ?? {
      attempts: 0,
      successes: 0,
      failures: 0,
      cacheHits: 0,
      totalLatencyMs: 0,
    };
    const d: OpStats = {
      attempts: s.attempts - prev.attempts,
      successes: s.successes - prev.successes,
      failures: s.failures - prev.failures,
      cacheHits: s.cacheHits - prev.cacheHits,
      totalLatencyMs: s.totalLatencyMs - prev.totalLatencyMs,
    };
    if (d.attempts <= 0 && d.cacheHits <= 0) continue;
    deltas[op] = d;
    any = true;
  }
  return any ? deltas : null;
}

/**
 * Flush counter deltas to /api/location/metrics (best-effort, never throws).
 * Uses sendBeacon when leaving the page so the request survives unload.
 */
export function flushLocationProviderStats(useBeacon = false): void {
  if (typeof window === "undefined") return;
  const deltas = computeDeltas();
  if (!deltas) return;
  // Mark as flushed optimistically — losing a delta is acceptable here.
  for (const [op, s] of stats.entries()) {
    flushed.set(op, { ...s });
  }
  const payload = JSON.stringify({ ops: deltas });
  try {
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(
        "/api/location/metrics",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/location/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* best effort */
  }
}

// Auto-flush: periodically while active, and when the tab is hidden/closed.
if (typeof window !== "undefined" && flushTimer == null) {
  flushTimer = setInterval(() => flushLocationProviderStats(false), FLUSH_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushLocationProviderStats(true);
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Latest-wins sequencing                                                     */
/* -------------------------------------------------------------------------- */

const sequences = new Map<string, number>();

/**
 * Returns a guard for async flows keyed by `key` (e.g. "checkout-reverse").
 * Call the returned function after each await; if it returns false the
 * result is stale (a newer request started) and must be discarded.
 *
 * Example:
 *   const fresh = latestWins("pin-reverse");
 *   const result = await locationProvider.reverseGeocode(...);
 *   if (!fresh()) return; // a newer reverse-geocode superseded this one
 */
export function latestWins(key: string): () => boolean {
  const seq = (sequences.get(key) ?? 0) + 1;
  sequences.set(key, seq);
  return () => sequences.get(key) === seq;
}

/* -------------------------------------------------------------------------- */
/* Provider interface                                                         */
/* -------------------------------------------------------------------------- */

export type ResolvedPlace = {
  lat: number;
  lng: number;
  name: string;
  formattedAddress: string;
  featureType: string;
  placeId?: string;
  confidence: LocationConfidence;
};

function suggestionToResolved(hit: AddressSuggestion): ResolvedPlace | null {
  if (
    typeof hit.lat !== "number" ||
    typeof hit.lng !== "number" ||
    !isValidLatLng(hit.lat, hit.lng)
  ) {
    return null;
  }
  return {
    lat: hit.lat,
    lng: hit.lng,
    name: hit.name,
    formattedAddress: hit.fullAddress || hit.name,
    featureType: hit.featureType,
    placeId: hit.mapboxId,
    confidence: confidenceFromProvider({
      featureType: hit.featureType,
      relevance: hit.relevance,
    }),
  };
}

async function timed<T>(
  op: LocationOpName,
  fn: () => Promise<T>,
  isSuccess: (v: T) => boolean,
): Promise<T> {
  const started = Date.now();
  try {
    const value = await fn();
    recordOp(op, isSuccess(value) ? "success" : "failure", Date.now() - started);
    return value;
  } catch (err) {
    // Aborted requests are not failures — the caller superseded them.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    recordOp(op, "failure", Date.now() - started);
    throw err;
  }
}

/**
 * Search for places matching a query (autocomplete-style, with coordinates).
 * Cached briefly per query+proximity.
 */
export async function searchLocation(
  query: string,
  opts?: { proximity?: LngLat; limit?: number; signal?: AbortSignal },
): Promise<ResolvedPlace[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const key = `search:${q}:${opts?.proximity ? coordKey(opts.proximity.lng, opts.proximity.lat) : "-"}:${opts?.limit ?? 5}`;
  const cached = cacheGet<ResolvedPlace[]>(key);
  if (cached) {
    recordOp("search", "cache_hit");
    return cached;
  }
  const hits = await timed(
    "search",
    () => searchBoxForward(query, opts),
    (v) => v.length > 0,
  );
  const resolved = hits
    .map(suggestionToResolved)
    .filter(Boolean) as ResolvedPlace[];
  if (resolved.length) cacheSet(key, resolved, TTL.forwardSearchMs);
  return resolved;
}

/**
 * Autocomplete suggestions (no coordinates until resolved). Uses Search Box
 * suggest with a billing session token; resolve selections with
 * `resolvePlace(mapboxId, sessionToken)`.
 */
export async function suggestLocations(
  query: string,
  opts?: {
    proximity?: LngLat;
    sessionToken?: string;
    limit?: number;
    signal?: AbortSignal;
  },
): Promise<{ suggestions: AddressSuggestion[]; sessionToken: string }> {
  return suggestAddresses(query, opts);
}

/** Resolve a suggestion (place ID) to coordinates + canonical fields. */
export async function resolvePlace(
  mapboxId: string,
  sessionToken: string,
  opts?: { signal?: AbortSignal },
): Promise<ResolvedPlace | null> {
  const key = `place:${mapboxId}`;
  const cached = cacheGet<ResolvedPlace | null>(key);
  if (cached !== undefined) {
    recordOp("resolve_place", "cache_hit");
    return cached;
  }
  const hit = await timed(
    "resolve_place",
    () => retrieveAddress(mapboxId, sessionToken, opts),
    (v) => v != null,
  );
  const resolved = hit ? suggestionToResolved(hit) : null;
  if (resolved) cacheSet(key, resolved, TTL.reverseGeocodeMs);
  return resolved;
}

export type ReverseGeocodeResult = {
  label: string;
  name: string;
  featureType: string;
  placeId?: string;
  confidence: LocationConfidence;
};

/**
 * Reverse geocode a coordinate. Cached at ~1m precision for 10 minutes.
 * Returns null on provider failure — callers keep the coordinate and allow
 * manual address entry.
 */
export async function reverseGeocodeLocation(
  lng: number,
  lat: number,
  opts?: { signal?: AbortSignal },
): Promise<ReverseGeocodeResult | null> {
  if (!isValidLatLng(lat, lng)) return null;
  const key = `rev:${coordKey(lng, lat)}`;
  const cached = cacheGet<ReverseGeocodeResult | null>(key);
  if (cached !== undefined) {
    recordOp("reverse_geocode", "cache_hit");
    return cached;
  }
  const hit = await timed(
    "reverse_geocode",
    () => searchBoxReverse(lng, lat, { signal: opts?.signal }),
    (v) => v != null,
  );
  if (!hit) return null;
  const result: ReverseGeocodeResult = {
    label: hit.fullAddress || hit.name,
    name: hit.name,
    featureType: hit.featureType,
    placeId: hit.mapboxId,
    confidence: confidenceFromProvider({
      featureType: hit.featureType,
      relevance: hit.relevance,
    }),
  };
  cacheSet(key, result, TTL.reverseGeocodeMs);
  return result;
}

/** Simple label-only reverse geocode (legacy-compatible). */
export async function reverseGeocodeLabel(
  lng: number,
  lat: number,
  opts?: { signal?: AbortSignal },
): Promise<string | null> {
  const result = await reverseGeocodeLocation(lng, lat, opts).catch((err) => {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return null;
  });
  if (result) return result.label;
  // Fall back to the raw helper once (different types filter) before giving up.
  try {
    return await mapboxReverseGeocode(lng, lat, opts);
  } catch {
    return null;
  }
}

/** Road route between two points. Cached for 2 minutes. */
export async function getRoute(
  from: LngLat,
  to: LngLat,
  profile: TravelProfile = "driving-traffic",
  opts?: { waypoints?: LngLat[]; signal?: AbortSignal },
): Promise<DirectionsResult | null> {
  const wp = (opts?.waypoints || [])
    .map((p) => coordKey(p.lng, p.lat))
    .join("|");
  const key = `route:${profile}:${coordKey(from.lng, from.lat)}>${wp}>${coordKey(to.lng, to.lat)}`;
  const cached = cacheGet<DirectionsResult>(key);
  if (cached) {
    recordOp("route", "cache_hit");
    return cached;
  }
  const route = await timed(
    "route",
    () =>
      fetchDirections(from, to, profile, {
        alternatives: false,
        waypoints: opts?.waypoints,
        signal: opts?.signal,
      }),
    (v) => v != null,
  );
  if (route) cacheSet(key, route, TTL.routeMs);
  return route;
}

/** Travel time/distance matrix. Cached for 2 minutes. */
export async function getDistanceMatrix(
  sources: LngLat[],
  destinations: LngLat[],
  profile: TravelProfile = "driving",
  opts?: { signal?: AbortSignal },
): Promise<MatrixResult | null> {
  const key = `matrix:${profile}:${sources.map((p) => coordKey(p.lng, p.lat)).join("|")}>${destinations.map((p) => coordKey(p.lng, p.lat)).join("|")}`;
  const cached = cacheGet<MatrixResult>(key);
  if (cached) {
    recordOp("matrix", "cache_hit");
    return cached;
  }
  const matrix = await timed(
    "matrix",
    () => fetchTravelMatrix(sources, destinations, profile, opts),
    (v) => v != null,
  );
  if (matrix) cacheSet(key, matrix, TTL.matrixMs);
  return matrix;
}

/** Snap a GPS trace to roads. Not cached (traces are unique). */
export async function matchRoute(
  points: LngLat[],
  profile: TravelProfile = "driving",
  opts?: { signal?: AbortSignal },
): Promise<DirectionsResult | null> {
  return timed(
    "match_route",
    () => matchTraceToRoads(points, profile, opts),
    (v) => v != null,
  );
}

/** Reachability polygons. Cached for 5 minutes. */
export async function getIsochrone(
  center: LngLat,
  opts?: {
    profile?: TravelProfile;
    contoursMinutes?: number[];
    signal?: AbortSignal;
  },
): Promise<GeoJSON.FeatureCollection | null> {
  const key = `iso:${opts?.profile || "driving"}:${coordKey(center.lng, center.lat)}:${(opts?.contoursMinutes || [15, 30]).join(",")}`;
  const cached = cacheGet<GeoJSON.FeatureCollection>(key);
  if (cached) {
    recordOp("isochrone", "cache_hit");
    return cached;
  }
  const iso = await timed(
    "isochrone",
    () => fetchIsochrone(center, opts),
    (v) => v != null,
  );
  if (iso) cacheSet(key, iso, TTL.isochroneMs);
  return iso;
}

/* -------------------------------------------------------------------------- */
/* Canonical helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Build a CanonicalLocation from a resolved provider place. */
export function canonicalFromResolvedPlace(
  place: ResolvedPlace,
  locationType: CanonicalLocation["locationType"],
): CanonicalLocation {
  return {
    lat: place.lat,
    lng: place.lng,
    locationType,
    formattedAddress: place.formattedAddress,
    placeId: place.placeId,
    source: "mapbox",
    confidence: place.confidence,
    verification: "unverified",
    capturedAt: Date.now(),
  };
}
