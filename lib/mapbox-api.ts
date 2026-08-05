/**
 * Mapbox Navigation + Search APIs (client-safe, public pk.* token).
 * Covers playground surfaces:
 * - Directions  https://docs.mapbox.com/playground/directions/
 * - Map Matching https://docs.mapbox.com/playground/map-matching/
 * - Search Box forward/reverse https://docs.mapbox.com/playground/search-box/forward-reverse/
 * - Search Box suggest/retrieve https://docs.mapbox.com/playground/search-box/suggest-retrieve/
 * - Matrix https://docs.mapbox.com/playground/matrix/
 * - Isochrone https://docs.mapbox.com/playground/isochrone/
 * - Offline estimator (tile-count helper for native offline regions)
 */
import { getMapboxToken, NAIROBI_CENTER } from "@/lib/mapbox";

export type LngLat = { lng: number; lat: number };

export type TravelProfile =
  | "driving-traffic"
  | "driving"
  | "walking"
  | "cycling";

export type AddressSuggestion = {
  id: string;
  mapboxId: string;
  name: string;
  fullAddress: string;
  featureType: string;
  lng?: number;
  lat?: number;
};

export type DirectionStep = {
  instruction: string;
  distanceM: number;
  durationS: number;
};

export type DirectionsResult = {
  distanceM: number;
  durationS: number;
  geometry: GeoJSON.LineString;
  profile: TravelProfile;
  steps: DirectionStep[];
  /** Optional congestion / speed samples along the route */
  annotations?: {
    duration?: number[];
    distance?: number[];
    speed?: number[];
    congestion?: string[];
  };
};

function tokenOrNull() {
  return getMapboxToken();
}

function newSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `kc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function coordsParam(points: LngLat[]) {
  return points.map((p) => `${p.lng},${p.lat}`).join(";");
}

/* -------------------------------------------------------------------------- */
/* Search Box — suggest / retrieve                                            */
/* https://docs.mapbox.com/playground/search-box/suggest-retrieve/            */
/* -------------------------------------------------------------------------- */

export async function suggestAddresses(
  query: string,
  opts?: {
    proximity?: LngLat;
    sessionToken?: string;
    limit?: number;
  },
): Promise<{ suggestions: AddressSuggestion[]; sessionToken: string }> {
  const token = tokenOrNull();
  const sessionToken = opts?.sessionToken || newSessionToken();
  if (!token || query.trim().length < 2) {
    return { suggestions: [], sessionToken };
  }

  const proximity = opts?.proximity || {
    lng: NAIROBI_CENTER[0],
    lat: NAIROBI_CENTER[1],
  };

  const params = new URLSearchParams({
    q: query.trim(),
    access_token: token,
    session_token: sessionToken,
    country: "ke",
    language: "en",
    limit: String(opts?.limit ?? 12),
    types:
      "country,region,postcode,district,place,city,locality,neighborhood,street,address,poi,category",
    proximity: `${proximity.lng},${proximity.lat}`,
    // Nairobi metro bias box
    bbox: "36.65,-1.45,37.05,-1.15",
  });

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`,
  );
  if (!res.ok) return { suggestions: [], sessionToken };

  const data = (await res.json()) as {
    suggestions?: Array<{
      mapbox_id: string;
      name: string;
      full_address?: string;
      place_formatted?: string;
      feature_type?: string;
    }>;
  };

  return {
    sessionToken,
    suggestions: (data.suggestions || []).map((s) => ({
      id: `addr_${s.mapbox_id}`,
      mapboxId: s.mapbox_id,
      name: s.name,
      fullAddress: s.full_address || s.place_formatted || s.name,
      featureType: s.feature_type || "place",
    })),
  };
}

export async function retrieveAddress(
  mapboxId: string,
  sessionToken: string,
): Promise<AddressSuggestion | null> {
  const token = tokenOrNull();
  if (!token) return null;

  const params = new URLSearchParams({
    access_token: token,
    session_token: sessionToken,
    language: "en",
  });

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        mapbox_id?: string;
        name?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
      };
    }>;
  };

  const feature = data.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!feature || !coords) return null;

  return {
    id: `addr_${mapboxId}`,
    mapboxId,
    name: feature.properties?.name || "Place",
    fullAddress:
      feature.properties?.full_address ||
      feature.properties?.place_formatted ||
      feature.properties?.name ||
      "Place",
    featureType: feature.properties?.feature_type || "place",
    lng: coords[0],
    lat: coords[1],
  };
}

/* -------------------------------------------------------------------------- */
/* Search Box — forward / reverse                                             */
/* https://docs.mapbox.com/playground/search-box/forward-reverse/             */
/* -------------------------------------------------------------------------- */

export async function searchBoxForward(
  query: string,
  opts?: { proximity?: LngLat; limit?: number },
): Promise<AddressSuggestion[]> {
  const token = tokenOrNull();
  const q = query.trim();
  if (!token || q.length < 2) return [];

  const prox = opts?.proximity || {
    lng: NAIROBI_CENTER[0],
    lat: NAIROBI_CENTER[1],
  };
  const params = new URLSearchParams({
    q,
    access_token: token,
    language: "en",
    country: "ke",
    limit: String(opts?.limit ?? 5),
    proximity: `${prox.lng},${prox.lat}`,
    types:
      "country,region,postcode,district,place,city,locality,neighborhood,street,address,poi",
  });

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/forward?${params}`,
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        mapbox_id?: string;
        name?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
      };
    }>;
  };

  return (data.features || [])
    .map((f) => {
      const c = f.geometry?.coordinates;
      if (!c) return null;
      const id = f.properties?.mapbox_id || `${c[0]},${c[1]}`;
      return {
        id: `fwd_${id}`,
        mapboxId: id,
        name: f.properties?.name || "Place",
        fullAddress:
          f.properties?.full_address ||
          f.properties?.place_formatted ||
          f.properties?.name ||
          "Place",
        featureType: f.properties?.feature_type || "place",
        lng: c[0],
        lat: c[1],
      } satisfies AddressSuggestion;
    })
    .filter(Boolean) as AddressSuggestion[];
}

export async function searchBoxReverse(
  lng: number,
  lat: number,
  opts?: { limit?: number },
): Promise<AddressSuggestion | null> {
  const token = tokenOrNull();
  if (!token) return null;

  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: token,
    language: "en",
    limit: String(opts?.limit ?? 1),
    types: "address,poi,neighborhood,locality,place",
  });

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/reverse?${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        mapbox_id?: string;
        name?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
      };
    }>;
  };

  const f = data.features?.[0];
  if (!f) return null;
  const c = f.geometry?.coordinates || [lng, lat];
  const id = f.properties?.mapbox_id || `${lng},${lat}`;
  return {
    id: `rev_${id}`,
    mapboxId: id,
    name: f.properties?.name || "Place",
    fullAddress:
      f.properties?.full_address ||
      f.properties?.place_formatted ||
      f.properties?.name ||
      "Place",
    featureType: f.properties?.feature_type || "place",
    lng: c[0],
    lat: c[1],
  } as AddressSuggestion;
}

/** Legacy-friendly wrappers used across the app */
export async function forwardGeocode(
  query: string,
  proximity?: LngLat,
): Promise<{ lng: number; lat: number; label: string } | null> {
  const hits = await searchBoxForward(query, { proximity, limit: 1 });
  const hit = hits[0];
  if (!hit?.lng || !hit?.lat) return null;
  return { lng: hit.lng, lat: hit.lat, label: hit.fullAddress || hit.name };
}

export async function reverseGeocode(
  lng: number,
  lat: number,
): Promise<string | null> {
  const hit = await searchBoxReverse(lng, lat);
  return hit?.fullAddress || hit?.name || null;
}

/** Multiple reverse-geocode candidates (“What's here?”). */
export async function searchBoxReverseMany(
  lng: number,
  lat: number,
  opts?: { limit?: number },
): Promise<AddressSuggestion[]> {
  const token = tokenOrNull();
  if (!token) return [];

  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: token,
    language: "en",
    limit: String(opts?.limit ?? 6),
    types: "address,poi,street,neighborhood,locality,place",
  });

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/reverse?${params}`,
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        mapbox_id?: string;
        name?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
      };
    }>;
  };

  return (data.features || [])
    .map((f, i) => {
      const c = f.geometry?.coordinates || [lng, lat];
      const id = f.properties?.mapbox_id || `rev_${lng}_${lat}_${i}`;
      return {
        id: `rev_${id}`,
        mapboxId: id,
        name: f.properties?.name || "Place",
        fullAddress:
          f.properties?.full_address ||
          f.properties?.place_formatted ||
          f.properties?.name ||
          "Place",
        featureType: f.properties?.feature_type || "place",
        lng: c[0],
        lat: c[1],
      } satisfies AddressSuggestion;
    })
    .filter(Boolean);
}

/**
 * Nearby POIs by canonical category id
 * (coffee, restaurant, gas_station, hotel, pharmacy, parking, atm, park…).
 * https://docs.mapbox.com/api/search/search-box/#category-search
 */
export async function searchCategory(
  categoryId: string,
  opts?: { proximity?: LngLat; limit?: number },
): Promise<AddressSuggestion[]> {
  const token = tokenOrNull();
  const id = categoryId.trim();
  if (!token || !id) return [];

  const prox = opts?.proximity || {
    lng: NAIROBI_CENTER[0],
    lat: NAIROBI_CENTER[1],
  };
  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    limit: String(opts?.limit ?? 12),
    proximity: `${prox.lng},${prox.lat}`,
  });

  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(id)}?${params}`,
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        mapbox_id?: string;
        name?: string;
        full_address?: string;
        place_formatted?: string;
        feature_type?: string;
        poi_category?: string[];
      };
    }>;
  };

  return (data.features || [])
    .map((f) => {
      const c = f.geometry?.coordinates;
      if (!c) return null;
      const mid = f.properties?.mapbox_id || `${c[0]},${c[1]}`;
      return {
        id: `cat_${mid}`,
        mapboxId: mid,
        name: f.properties?.name || id,
        fullAddress:
          f.properties?.full_address ||
          f.properties?.place_formatted ||
          f.properties?.name ||
          id,
        featureType:
          f.properties?.poi_category?.[0] ||
          f.properties?.feature_type ||
          "poi",
        lng: c[0],
        lat: c[1],
      } satisfies AddressSuggestion;
    })
    .filter(Boolean) as AddressSuggestion[];
}

/** Human label for Search Box feature types */
export function featureTypeLabel(type: string): string {
  const t = (type || "place").toLowerCase();
  const map: Record<string, string> = {
    poi: "Place",
    address: "Address",
    street: "Street",
    neighborhood: "Area",
    locality: "Locality",
    place: "City",
    city: "City",
    district: "District",
    region: "Region",
    postcode: "Postcode",
    country: "Country",
    category: "Category",
    restaurant: "Restaurant",
    coffee: "Cafe",
    gas_station: "Fuel",
    hotel: "Hotel",
    pharmacy: "Pharmacy",
    parking: "Parking",
    atm: "ATM",
    park: "Park",
    bank: "Bank",
    supermarket: "Market",
    grocery: "Grocery",
    shopping_mall: "Shopping",
    shop: "Shop",
    market: "Market",
  };
  return map[t] || t.replace(/_/g, " ");
}

/* -------------------------------------------------------------------------- */
/* Directions                                                                 */
/* https://docs.mapbox.com/playground/directions/                             */
/* -------------------------------------------------------------------------- */

export async function fetchDirections(
  from: LngLat,
  to: LngLat,
  profile: TravelProfile = "driving-traffic",
  opts?: {
    alternatives?: boolean;
    annotations?: string[];
    waypoints?: LngLat[];
  },
): Promise<DirectionsResult | null> {
  const routes = await fetchDirectionsAll(from, to, profile, opts);
  return routes[0] || null;
}

/** Primary + optional alternative routes */
export async function fetchDirectionsAll(
  from: LngLat,
  to: LngLat,
  profile: TravelProfile = "driving-traffic",
  opts?: {
    alternatives?: boolean;
    annotations?: string[];
    waypoints?: LngLat[];
  },
): Promise<DirectionsResult[]> {
  const token = tokenOrNull();
  if (!token) return [];

  const points = [from, ...(opts?.waypoints || []), to];
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    alternatives: opts?.alternatives === false ? "false" : "true",
    access_token: token,
  });
  const annotations = opts?.annotations || [
    "duration",
    "distance",
    "speed",
    "congestion",
  ];
  if (annotations.length) params.set("annotations", annotations.join(","));

  const res = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordsParam(points)}?${params}`,
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: GeoJSON.LineString;
      legs?: Array<{
        annotation?: {
          duration?: number[];
          distance?: number[];
          speed?: number[];
          congestion?: string[];
        };
        steps?: Array<{
          distance: number;
          duration: number;
          manoeuvre?: { instruction?: string };
          maneuver?: { instruction?: string };
        }>;
      }>;
    }>;
  };

  return (data.routes || [])
    .filter((r) => r.geometry)
    .map((route) => {
      const steps: DirectionStep[] = [];
      for (const leg of route.legs || []) {
        for (const step of leg.steps || []) {
          steps.push({
            instruction:
              step.maneuver?.instruction ||
              step.manoeuvre?.instruction ||
              "Continue",
            distanceM: step.distance,
            durationS: step.duration,
          });
        }
      }
      return {
        distanceM: route.distance,
        durationS: route.duration,
        geometry: route.geometry,
        profile,
        steps,
        annotations: route.legs?.[0]?.annotation,
      };
    });
}

export type OptimizedTripResult = {
  distanceM: number;
  durationS: number;
  geometry: GeoJSON.LineString;
  profile: TravelProfile;
  /** Visit order as indices into the input coordinates array */
  waypointOrder: number[];
  steps: DirectionStep[];
};

/**
 * Mapbox Optimization API — best visit order through 2–12 coordinates.
 * https://docs.mapbox.com/api/navigation/optimization/
 */
export async function fetchOptimizedTrip(
  coordinates: LngLat[],
  profile: TravelProfile = "driving",
  opts?: {
    roundtrip?: boolean;
    source?: "any" | "first";
    destination?: "any" | "last";
  },
): Promise<OptimizedTripResult | null> {
  const token = tokenOrNull();
  if (!token || coordinates.length < 2 || coordinates.length > 12) return null;

  // Optimization V1: driving-traffic → driving (traffic profile unsupported)
  const apiProfile =
    profile === "driving-traffic" ? "driving" : profile;
  const roundtrip = opts?.roundtrip ?? false;
  const source = opts?.source ?? (roundtrip ? "any" : "first");
  const destination = opts?.destination ?? (roundtrip ? "any" : "last");

  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    source,
    destination,
    roundtrip: String(roundtrip),
    access_token: token,
  });

  const res = await fetch(
    `https://api.mapbox.com/optimized-trips/v1/mapbox/${apiProfile}/${coordsParam(coordinates)}?${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    code?: string;
    trips?: Array<{
      distance: number;
      duration: number;
      geometry: GeoJSON.LineString;
      legs?: Array<{
        steps?: Array<{
          distance: number;
          duration: number;
          maneuver?: { instruction?: string };
          manoeuvre?: { instruction?: string };
        }>;
      }>;
    }>;
    waypoints?: Array<{ waypoint_index?: number; trips_index?: number }>;
  };

  const trip = data.trips?.[0];
  if (!trip?.geometry) return null;

  const steps: DirectionStep[] = [];
  for (const leg of trip.legs || []) {
    for (const step of leg.steps || []) {
      steps.push({
        instruction:
          step.maneuver?.instruction ||
          step.manoeuvre?.instruction ||
          "Continue",
        distanceM: step.distance,
        durationS: step.duration,
      });
    }
  }

  // waypoint_index is the position in the optimized trip; array index is input order
  const waypointOrder = (data.waypoints || [])
    .map((w, inputIndex) => ({
      inputIndex,
      order: w.waypoint_index ?? inputIndex,
    }))
    .sort((a, b) => a.order - b.order)
    .map((w) => w.inputIndex);

  return {
    distanceM: trip.distance,
    durationS: trip.duration,
    geometry: trip.geometry,
    profile: apiProfile,
    waypointOrder,
    steps,
  };
}

/* -------------------------------------------------------------------------- */
/* Map Matching                                                               */
/* https://docs.mapbox.com/playground/map-matching/                           */
/* -------------------------------------------------------------------------- */

export async function matchTraceToRoads(
  points: LngLat[],
  profile: TravelProfile = "driving",
  opts?: { tidy?: boolean },
): Promise<DirectionsResult | null> {
  const token = tokenOrNull();
  if (!token || points.length < 2) return null;

  // Map Matching allows max 100 coordinates
  const clipped = points.slice(0, 100);
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    tidy: opts?.tidy === false ? "false" : "true",
    access_token: token,
  });

  // driving-traffic is not supported for matching — fall back to driving
  const matchProfile =
    profile === "driving-traffic" ? "driving" : profile;

  const res = await fetch(
    `https://api.mapbox.com/matching/v5/mapbox/${matchProfile}/${coordsParam(clipped)}?${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    matchings?: Array<{
      distance: number;
      duration: number;
      geometry: GeoJSON.LineString;
      legs?: Array<{
        steps?: Array<{
          distance: number;
          duration: number;
          maneuver?: { instruction?: string };
        }>;
      }>;
    }>;
  };

  const match = data.matchings?.[0];
  if (!match?.geometry) return null;

  const steps: DirectionStep[] = [];
  for (const leg of match.legs || []) {
    for (const step of leg.steps || []) {
      steps.push({
        instruction: step.maneuver?.instruction || "Continue",
        distanceM: step.distance,
        durationS: step.duration,
      });
    }
  }

  return {
    distanceM: match.distance,
    durationS: match.duration,
    geometry: match.geometry,
    profile: matchProfile,
    steps,
  };
}

/* -------------------------------------------------------------------------- */
/* Matrix                                                                     */
/* https://docs.mapbox.com/playground/matrix/                                 */
/* -------------------------------------------------------------------------- */

export type MatrixResult = {
  durations: (number | null)[][];
  distances: (number | null)[][];
};

export async function fetchTravelMatrix(
  sources: LngLat[],
  destinations: LngLat[],
  profile: TravelProfile = "driving",
): Promise<MatrixResult | null> {
  const token = tokenOrNull();
  if (!token || !sources.length || !destinations.length) return null;

  // Matrix coordinate limit is typically 25 coordinates total
  const all = [...sources, ...destinations].slice(0, 25);
  const sourceCount = Math.min(sources.length, all.length);
  const destCount = Math.min(destinations.length, all.length - sourceCount);
  if (sourceCount < 1 || destCount < 1) return null;

  const points = [
    ...sources.slice(0, sourceCount),
    ...destinations.slice(0, destCount),
  ];
  const sourceIdx = Array.from({ length: sourceCount }, (_, i) => i).join(";");
  const destIdx = Array.from(
    { length: destCount },
    (_, i) => i + sourceCount,
  ).join(";");

  // Matrix does not support driving-traffic in all accounts — use driving
  const matrixProfile =
    profile === "driving-traffic" ? "driving" : profile;

  const params = new URLSearchParams({
    annotations: "duration,distance",
    sources: sourceIdx,
    destinations: destIdx,
    access_token: token,
  });

  const res = await fetch(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/${matrixProfile}/${coordsParam(points)}?${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    durations?: (number | null)[][];
    distances?: (number | null)[][];
  };

  return {
    durations: data.durations || [],
    distances: data.distances || [],
  };
}

/** One-to-many ETAs (seconds / meters) from a single origin */
export async function fetchEtasFromOrigin(
  origin: LngLat,
  destinations: LngLat[],
  profile: TravelProfile = "driving",
): Promise<Array<{ durationS: number | null; distanceM: number | null }>> {
  if (!destinations.length) return [];
  const matrix = await fetchTravelMatrix([origin], destinations, profile);
  if (!matrix) {
    return destinations.map(() => ({ durationS: null, distanceM: null }));
  }
  return destinations.map((_, i) => ({
    durationS: matrix.durations[0]?.[i] ?? null,
    distanceM: matrix.distances[0]?.[i] ?? null,
  }));
}

/* -------------------------------------------------------------------------- */
/* Isochrone                                                                  */
/* https://docs.mapbox.com/playground/isochrone/                              */
/* -------------------------------------------------------------------------- */

export async function fetchIsochrone(
  center: LngLat,
  opts?: {
    profile?: TravelProfile;
    /** Contour minutes, e.g. [10, 20, 30] — max 4 */
    contoursMinutes?: number[];
    polygons?: boolean;
  },
): Promise<GeoJSON.FeatureCollection | null> {
  const token = tokenOrNull();
  if (!token) return null;

  const profile =
    opts?.profile === "driving-traffic"
      ? "driving"
      : opts?.profile || "driving";
  const minutes = (opts?.contoursMinutes || [15, 30]).slice(0, 4);

  const params = new URLSearchParams({
    contours_minutes: minutes.join(","),
    polygons: opts?.polygons === false ? "false" : "true",
    access_token: token,
  });

  const res = await fetch(
    `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${center.lng},${center.lat}?${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as GeoJSON.FeatureCollection;
  return data?.features ? data : null;
}

/* -------------------------------------------------------------------------- */
/* Offline estimator (tile-count helper)                                      */
/* https://docs.mapbox.com/playground/offline-estimator/                      */
/* Full offline rendering is Maps SDK iOS/Android — this estimates size.      */
/* -------------------------------------------------------------------------- */

export type OfflineEstimate = {
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  /** Rough size assuming ~25KB average vector tile */
  estimatedBytes: number;
  estimatedMB: number;
};

function lngToTileX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToTileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      2 ** z,
  );
}

/** Estimate vector tile count for a bbox + zoom range (offline region planning). */
export function estimateOfflineTiles(opts: {
  west: number;
  south: number;
  east: number;
  north: number;
  minZoom?: number;
  maxZoom?: number;
}): OfflineEstimate {
  const minZoom = Math.max(0, opts.minZoom ?? 0);
  const maxZoom = Math.min(16, opts.maxZoom ?? 14);
  let tileCount = 0;

  for (let z = minZoom; z <= maxZoom; z++) {
    const x0 = lngToTileX(opts.west, z);
    const x1 = lngToTileX(opts.east, z);
    const y0 = latToTileY(opts.north, z);
    const y1 = latToTileY(opts.south, z);
    const w = Math.abs(x1 - x0) + 1;
    const h = Math.abs(y1 - y0) + 1;
    tileCount += w * h;
  }

  const estimatedBytes = tileCount * 25_000;
  return {
    minZoom,
    maxZoom,
    tileCount,
    estimatedBytes,
    estimatedMB: Math.round((estimatedBytes / (1024 * 1024)) * 10) / 10,
  };
}

/** Nairobi metro default offline pack estimate */
export function estimateNairobiOfflinePack(maxZoom = 14): OfflineEstimate {
  return estimateOfflineTiles({
    west: 36.65,
    south: -1.45,
    east: 37.05,
    north: -1.15,
    minZoom: 8,
    maxZoom,
  });
}
