import { distanceKm } from "@/lib/mapbox";
import type { ProductOffer } from "@/types";

export type OfferUserPoint = { lat: number; lng: number };

export type RankedOffer = ProductOffer & {
  /** Distance from shopper when both have coords; otherwise null */
  distanceKm: number | null;
};

export type OfferSortMode = "best" | "nearest" | "cheapest" | "area";

/** In-stock published offers only. */
export function filterAvailableOffers(offers: ProductOffer[]): ProductOffer[] {
  return offers.filter(
    (o) => o.status === "published" && Number(o.stock) > 0,
  );
}

function offerDistanceKm(
  offer: ProductOffer,
  user: OfferUserPoint | null | undefined,
): number | null {
  if (
    !user ||
    offer.lat == null ||
    offer.lng == null ||
    !Number.isFinite(offer.lat) ||
    !Number.isFinite(offer.lng)
  ) {
    return null;
  }
  return distanceKm(user, { lat: offer.lat, lng: offer.lng });
}

/**
 * Rank offers for PDP: in-stock → nearest (when GPS) → cheapest → vendor name.
 */
export function rankOffers(
  offers: ProductOffer[],
  user?: OfferUserPoint | null,
): RankedOffer[] {
  const available = filterAvailableOffers(offers);
  const ranked: RankedOffer[] = available.map((o) => ({
    ...o,
    distanceKm: offerDistanceKm(o, user),
  }));

  ranked.sort((a, b) => {
    const da = a.distanceKm;
    const db = b.distanceKm;
    if (da != null && db != null && da !== db) return da - db;
    if (da != null && db == null) return -1;
    if (da == null && db != null) return 1;
    if (a.price !== b.price) return a.price - b.price;
    return a.vendorName.localeCompare(b.vendorName);
  });

  return ranked;
}

/** Re-sort a ranked list for the browse-all sheet. */
export function sortRankedOffers(
  offers: RankedOffer[],
  mode: OfferSortMode,
  user?: OfferUserPoint | null,
): RankedOffer[] {
  const list = offers.map((o) => ({
    ...o,
    distanceKm: o.distanceKm ?? offerDistanceKm(o, user),
  }));

  if (mode === "best") {
    return rankOffers(list, user);
  }

  list.sort((a, b) => {
    if (mode === "nearest") {
      const da = a.distanceKm;
      const db = b.distanceKm;
      if (da != null && db != null && da !== db) return da - db;
      if (da != null && db == null) return -1;
      if (da == null && db != null) return 1;
      if (a.price !== b.price) return a.price - b.price;
      return a.vendorName.localeCompare(b.vendorName);
    }
    if (mode === "cheapest") {
      if (a.price !== b.price) return a.price - b.price;
      const da = a.distanceKm;
      const db = b.distanceKm;
      if (da != null && db != null && da !== db) return da - db;
      return a.vendorName.localeCompare(b.vendorName);
    }
    // area
    const na = (a.neighbourhood || a.address || "").toLowerCase();
    const nb = (b.neighbourhood || b.address || "").toLowerCase();
    if (na !== nb) return na.localeCompare(nb);
    if (a.price !== b.price) return a.price - b.price;
    return a.vendorName.localeCompare(b.vendorName);
  });

  return list;
}

export const TOP_OFFER_COUNT = 5;
