/**
 * Best-route helpers for checkout maps.
 * - Delivery: shop → home (driver pickup + drop-off), multi-shop optimized trip
 * - Pickup: user → each shop (customer collect path)
 */
import {
  fetchDirectionsAll,
  fetchOptimizedTrip,
  type LngLat,
} from "@/lib/mapbox-api";

export type ShopCoord = {
  vendorId: string;
  name: string;
  lat: number;
  lng: number;
};

export type ShopLegRoute = {
  vendorId: string;
  name: string;
  distanceKm: number;
  etaMinutes: number;
  geometry: GeoJSON.LineString;
  /** Fastest shop→home (or user→shop) among Mapbox alternatives */
  isBest: boolean;
};

export type DeliveryTripRoutes = {
  /** Highlighted path drivers take (optimized multi-shop→home, or best single leg) */
  driverRoute: GeoJSON.LineString | null;
  driverMeta: { distanceKm: number; etaMinutes: number } | null;
  /** Per-shop best shop→home legs (for secondary lines + list) */
  shopLegs: ShopLegRoute[];
  /** Vendor ids in driver visit order (excluding home) */
  stopOrder: string[];
};

export type PickupTripRoutes = {
  /** Fastest user→shop path (highlighted) */
  bestRoute: GeoJSON.LineString | null;
  bestMeta: { distanceKm: number; etaMinutes: number; vendorId: string } | null;
  shopLegs: ShopLegRoute[];
};

function pickBest(
  routes: Array<{
    distanceM: number;
    durationS: number;
    geometry: GeoJSON.LineString;
  }>,
) {
  if (!routes.length) return null;
  return [...routes].sort(
    (a, b) => a.durationS - b.durationS || a.distanceM - b.distanceM,
  )[0];
}

/**
 * Driver delivery routes: each shop → home (best with traffic),
 * plus an optimized multi-stop trip ending at home when 2+ shops.
 */
export async function buildDeliveryTripRoutes(
  home: LngLat,
  shops: ShopCoord[],
): Promise<DeliveryTripRoutes> {
  const valid = shops.filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng),
  );
  if (!valid.length) {
    return {
      driverRoute: null,
      driverMeta: null,
      shopLegs: [],
      stopOrder: [],
    };
  }

  const legs = await Promise.all(
    valid.map(async (shop) => {
      const routes = await fetchDirectionsAll(
        { lng: shop.lng, lat: shop.lat },
        home,
        "driving-traffic",
        { alternatives: true },
      );
      const best = pickBest(routes);
      if (!best?.geometry?.coordinates?.length) return null;
      return {
        vendorId: shop.vendorId,
        name: shop.name,
        distanceKm: best.distanceM / 1000,
        etaMinutes: Math.max(1, Math.round(best.durationS / 60)),
        geometry: best.geometry,
        durationS: best.durationS,
      };
    }),
  );

  const filled = legs.filter(
    (l): l is NonNullable<typeof l> => !!l,
  );
  if (!filled.length) {
    return {
      driverRoute: null,
      driverMeta: null,
      shopLegs: [],
      stopOrder: [],
    };
  }

  // Fastest individual shop→home among all shops
  const fastestIdx = filled.reduce(
    (best, leg, i, arr) =>
      leg.durationS < arr[best].durationS ? i : best,
    0,
  );

  const shopLegs: ShopLegRoute[] = filled
    .map((leg, i) => ({
      vendorId: leg.vendorId,
      name: leg.name,
      distanceKm: leg.distanceKm,
      etaMinutes: leg.etaMinutes,
      geometry: leg.geometry,
      isBest: i === fastestIdx,
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm);

  let driverRoute: GeoJSON.LineString | null = filled[fastestIdx].geometry;
  let driverMeta = {
    distanceKm: filled[fastestIdx].distanceKm,
    etaMinutes: filled[fastestIdx].etaMinutes,
  };
  let stopOrder = [filled[fastestIdx].vendorId];

  if (valid.length >= 2) {
    const coords: LngLat[] = [
      ...valid.map((s) => ({ lng: s.lng, lat: s.lat })),
      home,
    ];
    const trip = await fetchOptimizedTrip(coords, "driving", {
      roundtrip: false,
      source: "any",
      destination: "last",
    });
    if (trip?.geometry?.coordinates?.length) {
      driverRoute = trip.geometry;
      driverMeta = {
        distanceKm: trip.distanceM / 1000,
        etaMinutes: Math.max(1, Math.round(trip.durationS / 60)),
      };
      // waypointOrder indexes into coords; drop the home (last input index)
      const homeIndex = valid.length;
      stopOrder = trip.waypointOrder
        .filter((i) => i !== homeIndex && i >= 0 && i < valid.length)
        .map((i) => valid[i].vendorId);
    }
  }

  return { driverRoute, driverMeta, shopLegs, stopOrder };
}

/**
 * Customer pickup routes: current location → each shop (best with traffic).
 * Highlights the nearest/fastest shop path.
 */
export async function buildPickupTripRoutes(
  origin: LngLat,
  shops: ShopCoord[],
): Promise<PickupTripRoutes> {
  const valid = shops.filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng),
  );
  if (!valid.length) {
    return { bestRoute: null, bestMeta: null, shopLegs: [] };
  }

  const legs = await Promise.all(
    valid.map(async (shop) => {
      const routes = await fetchDirectionsAll(
        origin,
        { lng: shop.lng, lat: shop.lat },
        "driving-traffic",
        { alternatives: true },
      );
      const best = pickBest(routes);
      if (!best?.geometry?.coordinates?.length) return null;
      return {
        vendorId: shop.vendorId,
        name: shop.name,
        distanceKm: best.distanceM / 1000,
        etaMinutes: Math.max(1, Math.round(best.durationS / 60)),
        geometry: best.geometry,
        durationS: best.durationS,
      };
    }),
  );

  const filled = legs.filter(
    (l): l is NonNullable<typeof l> => !!l,
  );
  if (!filled.length) {
    return { bestRoute: null, bestMeta: null, shopLegs: [] };
  }

  const fastestIdx = filled.reduce(
    (best, leg, i, arr) =>
      leg.durationS < arr[best].durationS ? i : best,
    0,
  );

  const shopLegs: ShopLegRoute[] = filled
    .map((leg, i) => ({
      vendorId: leg.vendorId,
      name: leg.name,
      distanceKm: leg.distanceKm,
      etaMinutes: leg.etaMinutes,
      geometry: leg.geometry,
      isBest: i === fastestIdx,
    }))
    .sort((a, b) => a.etaMinutes - b.etaMinutes);

  const best = filled[fastestIdx];
  return {
    bestRoute: best.geometry,
    bestMeta: {
      distanceKm: best.distanceKm,
      etaMinutes: best.etaMinutes,
      vendorId: best.vendorId,
    },
    shopLegs,
  };
}

/** Secondary lines for MapCanvas alt layer (skip one vendor when it is the primary). */
export function shopLegsToAltGeoJSON(
  legs: ShopLegRoute[],
  hideVendorId?: string | null,
): GeoJSON.FeatureCollection | null {
  const features = legs
    .filter((leg) => !hideVendorId || leg.vendorId !== hideVendorId)
    .map((leg) => ({
      type: "Feature" as const,
      properties: {
        vendorId: leg.vendorId,
        name: leg.name,
        isBest: leg.isBest,
      },
      geometry: leg.geometry,
    }));

  if (!features.length) return null;
  return { type: "FeatureCollection", features };
}
