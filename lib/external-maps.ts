/** Outbound Google Maps deep links (no Google SDK). */

export type ExternalMapsPoint = {
  lng: number;
  lat: number;
  label?: string;
};

export type GoogleTravelMode = "driving" | "walking" | "bicycling" | "transit";

/** Directions to a destination (optional origin + travel mode). */
export function googleMapsDirectionsUrl(
  destination: ExternalMapsPoint,
  origin?: ExternalMapsPoint | null,
  travelMode: GoogleTravelMode = "driving",
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: travelMode,
  });
  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Open a place pin in Google Maps. */
export function googleMapsPlaceUrl(point: ExternalMapsPoint): string {
  const q = encodeURIComponent(
    point.label || `${point.lat},${point.lng}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Coordinate pin URL (always precise). */
export function googleMapsCoordsUrl(point: ExternalMapsPoint): string {
  return `https://www.google.com/maps?q=${point.lat},${point.lng}`;
}

/** Street View–style external open (Google handles panorama if available). */
export function googleMapsStreetViewUrl(point: ExternalMapsPoint): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point.lat},${point.lng}`;
}

/** Embeddable Street View iframe src (no Google Maps JS SDK). */
export function googleStreetViewEmbedUrl(point: ExternalMapsPoint): string {
  const params = new URLSearchParams({
    q: "",
    layer: "c",
    cbll: `${point.lat},${point.lng}`,
    cbp: "11,0,0,0,0",
    ie: "UTF8",
    output: "svembed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

/** Free-text search centered near a point (Google Maps). */
export function googleMapsSearchUrl(
  query: string,
  near?: ExternalMapsPoint | null,
): string {
  const q = encodeURIComponent(query.trim());
  if (near) {
    return `https://www.google.com/maps/search/${q}/@${near.lat},${near.lng},15z`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Shareable Google Maps link for a pin. */
export function googleMapsShareUrl(point: ExternalMapsPoint): string {
  if (point.label) {
    return googleMapsPlaceUrl(point);
  }
  return googleMapsCoordsUrl(point);
}

export type ExternalMapsMode =
  | "directions"
  | "place"
  | "streetview"
  | "coords"
  | "share"
  | "search";

export function openExternalMaps(
  point: ExternalMapsPoint,
  mode: ExternalMapsMode = "directions",
  origin?: ExternalMapsPoint | null,
  opts?: { query?: string; travelMode?: GoogleTravelMode },
) {
  if (typeof window === "undefined") return;
  let url: string;
  switch (mode) {
    case "place":
      url = googleMapsPlaceUrl(point);
      break;
    case "streetview":
      url = googleMapsStreetViewUrl(point);
      break;
    case "coords":
      url = googleMapsCoordsUrl(point);
      break;
    case "share":
      url = googleMapsShareUrl(point);
      break;
    case "search":
      url = googleMapsSearchUrl(opts?.query || point.label || "places", point);
      break;
    default:
      url = googleMapsDirectionsUrl(
        point,
        origin,
        opts?.travelMode || "driving",
      );
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
