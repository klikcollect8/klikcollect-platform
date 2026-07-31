/**
 * Mapbox Search Box + Directions helpers (client-side, public token).
 */
import { getMapboxToken, NAIROBI_CENTER } from "@/lib/mapbox";

export type AddressSuggestion = {
  id: string;
  mapboxId: string;
  name: string;
  fullAddress: string;
  featureType: string;
  /** Present after retrieve; suggest may omit coords */
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
};

export type TravelProfile = "driving-traffic" | "walking" | "cycling";

function newSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `kc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Suggest addresses / places via Search Box API */
export async function suggestAddresses(
  query: string,
  opts?: {
    proximity?: { lng: number; lat: number };
    sessionToken?: string;
    limit?: number;
  },
): Promise<{ suggestions: AddressSuggestion[]; sessionToken: string }> {
  const token = getMapboxToken();
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
    limit: String(opts?.limit ?? 8),
    // Streets, districts, addresses, POIs — anything Mapbox can resolve
    types:
      "address,street,neighborhood,locality,place,district,region,postcode,poi",
    proximity: `${proximity.lng},${proximity.lat}`,
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

  const suggestions: AddressSuggestion[] = (data.suggestions || []).map((s) => ({
    id: `addr_${s.mapbox_id}`,
    mapboxId: s.mapbox_id,
    name: s.name,
    fullAddress: s.full_address || s.place_formatted || s.name,
    featureType: s.feature_type || "place",
  }));

  return { suggestions, sessionToken };
}

/** Retrieve coordinates for a Search Box suggestion */
export async function retrieveAddress(
  mapboxId: string,
  sessionToken: string,
): Promise<AddressSuggestion | null> {
  const token = getMapboxToken();
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

/** Reverse geocode a map click */
export async function reverseGeocode(
  lng: number,
  lat: number,
): Promise<string | null> {
  const token = getMapboxToken();
  if (!token) return null;

  const params = new URLSearchParams({
    access_token: token,
    language: "en",
    limit: "1",
    types: "address,poi,neighborhood,locality,place",
  });

  const res = await fetch(
    `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    features?: Array<{
      properties?: {
        full_address?: string;
        name?: string;
        place_formatted?: string;
      };
    }>;
  };

  const f = data.features?.[0]?.properties;
  return f?.full_address || f?.place_formatted || f?.name || null;
}

/** Route between two points */
export async function fetchDirections(
  from: { lng: number; lat: number },
  to: { lng: number; lat: number },
  profile: TravelProfile = "driving-traffic",
): Promise<DirectionsResult | null> {
  const token = getMapboxToken();
  if (!token) return null;

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    banner_instructions: "true",
    voice_instructions: "false",
    access_token: token,
  });

  const res = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?${params}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: GeoJSON.LineString;
      legs?: Array<{
        steps?: Array<{
          distance: number;
          duration: number;
          manoeuvre?: { instruction?: string };
          maneuver?: { instruction?: string };
        }>;
      }>;
    }>;
  };

  const route = data.routes?.[0];
  if (!route?.geometry) return null;

  const steps: DirectionStep[] = [];
  for (const leg of route.legs || []) {
    for (const step of leg.steps || []) {
      const instruction =
        step.maneuver?.instruction ||
        step.manoeuvre?.instruction ||
        "Continue";
      steps.push({
        instruction,
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
  };
}
