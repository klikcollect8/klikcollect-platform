/**
 * Canonical location model for the KlikCollect location system.
 *
 * The system distinguishes between:
 * - ADDRESS (descriptive text — "Juja Road, Nairobi")
 * - GEOGRAPHIC LOCATION (lat/lng coordinate)
 * - DELIVERY POINT (authoritative coordinate + delivery context)
 * - USER'S CURRENT LOCATION (GPS fix with accuracy)
 * - VENDOR LOCATION (branch pin)
 * - ROUTE LOCATION (waypoint)
 * - LOCATION CONFIDENCE (how much we trust the resolved coordinate)
 *
 * These are NOT interchangeable — a textual address alone is never assumed
 * to be an accurate delivery location.
 */

/** What kind of location a record represents. */
export type LocationType =
  | "customer_address"
  | "delivery_point"
  | "vendor_branch"
  | "pickup_point"
  | "driver_location"
  | "route_waypoint"
  | "saved_location";

/** How much we trust the resolved coordinate. */
export type LocationConfidence =
  | "high"
  | "medium"
  | "low"
  | "user_pinned"
  | "gps_verified"
  | "provider_resolved"
  | "manual";

/** Verification state — separate from confidence (who/what confirmed it). */
export type LocationVerification =
  | "unverified"
  | "user_pinned"
  | "gps_verified"
  | "admin_verified";

/** Where the coordinate came from. */
export type LocationSource = "mapbox" | "gps" | "manual" | "seed" | "unknown";

/**
 * Canonical location representation. Only lat/lng/locationType are required;
 * every location type carries only the fields that make sense for it.
 */
export type CanonicalLocation = {
  lat: number;
  lng: number;
  locationType: LocationType;

  /** Full display string, e.g. "Garden City Mall, Thika Road, Nairobi" */
  formattedAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  neighbourhood?: string;
  estate?: string;
  building?: string;
  floor?: string;
  /** Apartment / unit */
  unit?: string;
  landmark?: string;
  city?: string;
  county?: string;
  country?: string;
  postalCode?: string;

  /** Provider place ID (e.g. Mapbox ID) when available */
  placeId?: string;
  /** Who produced the coordinate */
  source?: LocationSource;
  confidence?: LocationConfidence;
  verification?: LocationVerification;
  /** GPS accuracy in metres, when source is gps */
  accuracyM?: number;
  /** Epoch ms when the location was captured/resolved */
  capturedAt?: number;
};

/* -------------------------------------------------------------------------- */
/* Confidence derivation + UI copy                                            */
/* -------------------------------------------------------------------------- */

/** GPS accuracy (m) at or below which a fix counts as verified-exact. */
export const GPS_VERIFIED_ACCURACY_M = 35;
/** GPS accuracy (m) at or below which a fix is usable but approximate. */
export const GPS_USABLE_ACCURACY_M = 120;

/** Derive confidence for a GPS fix from its reported accuracy. */
export function confidenceFromGpsAccuracy(
  accuracyM: number | null | undefined,
): LocationConfidence {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return "low";
  if (accuracyM <= GPS_VERIFIED_ACCURACY_M) return "gps_verified";
  if (accuracyM <= GPS_USABLE_ACCURACY_M) return "medium";
  return "low";
}

/**
 * Derive confidence for a provider (Mapbox) result.
 * Search Box does not always return numeric relevance; feature type is a
 * strong proxy — exact addresses/POIs geocode tightly, areas do not.
 */
export function confidenceFromProvider(opts: {
  featureType?: string;
  relevance?: number;
}): LocationConfidence {
  if (typeof opts.relevance === "number") {
    if (opts.relevance >= 0.9) return "high";
    if (opts.relevance >= 0.6) return "medium";
    return "low";
  }
  const t = (opts.featureType || "").toLowerCase();
  if (t === "address" || t === "poi") return "high";
  if (t === "street" || t === "neighborhood" || t === "locality") {
    return "medium";
  }
  if (!t || t === "place" || t === "city" || t === "district" || t === "region") {
    return "low";
  }
  return "medium";
}

/** Short badge label per confidence state. */
export function confidenceLabel(confidence: LocationConfidence): string {
  switch (confidence) {
    case "high":
      return "Exact location";
    case "medium":
      return "Approximate";
    case "low":
      return "Needs confirmation";
    case "user_pinned":
      return "Pin confirmed";
    case "gps_verified":
      return "GPS verified";
    case "provider_resolved":
      return "Address matched";
    case "manual":
      return "Entered manually";
  }
}

/** Longer helper copy shown near the confidence badge. */
export function confidenceMessage(confidence: LocationConfidence): string {
  switch (confidence) {
    case "high":
      return "Exact location found.";
    case "medium":
      return "Location found — please confirm the pin.";
    case "low":
      return "We couldn't confidently identify this address. Move the pin to your exact location.";
    case "user_pinned":
      return "Delivery point manually confirmed.";
    case "gps_verified":
      return "Your device location was used.";
    case "provider_resolved":
      return "Resolved from the address — please confirm the pin.";
    case "manual":
      return "Entered manually — add a pin for precise delivery.";
  }
}

/** Whether a confidence state should be treated as reliable for routing. */
export function isReliableConfidence(
  confidence: LocationConfidence | null | undefined,
): boolean {
  return (
    confidence === "high" ||
    confidence === "user_pinned" ||
    confidence === "gps_verified"
  );
}
