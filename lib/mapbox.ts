/** Mapbox client helpers - public token only. */

export const NAIROBI_CENTER: [number, number] = [36.8219, -1.2921];

/** Marketplace camera - north-up, soft tilt, street-level zoom */
export const DEFAULT_MAP_ZOOM = 15.4;
export const PREVIEW_MAP_ZOOM = 16.2;
export const LIVE_MAP_ZOOM = 16.2;
export const SEARCH_MAP_ZOOM = 16.6;
export const AREA_MAP_ZOOM = 14.6;

export const MAPBOX_OWNER = "klikcollect";

/** Default marketplace street style */
export const MAPBOX_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE?.trim() ||
  "mapbox://styles/klikcollect/cms9a6q5q000501p7f9yu4a08";

export const MAPBOX_SATELLITE_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_SATELLITE_STYLE?.trim() ||
  "mapbox://styles/klikcollect/cms98upt2008601sf165y4ked";

export const MAPBOX_3D_STYLE =
  process.env.NEXT_PUBLIC_MAPBOX_3D_STYLE?.trim() ||
  "mapbox://styles/klikcollect/cms8uzags007001sf26gqfifb";

export const MAPBOX_STATIC_STYLE = "mapbox/streets-v12";
/** Classic Mapbox Streets — crisp labeling & road hierarchy */
export const MAPBOX_FLAT_STYLE = "mapbox://styles/mapbox/streets-v12";
/** Alias: Perfect Street basemap */
export const MAPBOX_PERFECT_STREET_STYLE = MAPBOX_FLAT_STYLE;
export const MAPBOX_STYLE_FALLBACK = "mapbox://styles/mapbox/standard";

export const MAP_PITCH = 42;
export const MAP_SATELLITE_PITCH = 60;
export const MAP_BEARING = 0;
export const MAP_FLAT_PITCH = 0;
export const MAP_FLAT_ZOOM = 16.5;

export type MapStyleId = "street" | "perfect" | "satellite" | "map-3d";

export type MapStylePreset = {
  id: MapStyleId;
  name: string;
  description: string;
  url: string;
  defaultPitch: number;
  defaultBearing: number;
  terrain: boolean;
  buildings: boolean;
  flat?: boolean;
  accent: string;
  swatch: string;
};

export const MAPBOX_STYLE_PRESETS: MapStylePreset[] = [
  {
    id: "street",
    name: "Street",
    description: "Branded marketplace streets",
    url: MAPBOX_STYLE,
    defaultPitch: 0,
    defaultBearing: 0,
    terrain: false,
    buildings: true,
    flat: true,
    accent: "#0a0a0a",
    swatch: "linear-gradient(135deg,#e8ebe6,#f7f7f5 55%,#dce4dc)",
  },
  {
    id: "perfect",
    name: "Perfect",
    description: "Perfect Street · classic Mapbox streets",
    url: MAPBOX_PERFECT_STREET_STYLE,
    defaultPitch: 0,
    defaultBearing: 0,
    terrain: false,
    buildings: true,
    flat: true,
    accent: "#1a73e8",
    swatch: "linear-gradient(135deg,#e8f0fe,#ffffff 50%,#d2e3fc)",
  },
  {
    id: "satellite",
    name: "Satellite",
    description: "Aerial imagery · 3D tilt",
    url: MAPBOX_SATELLITE_STYLE,
    defaultPitch: 60,
    defaultBearing: -8,
    terrain: true,
    buildings: true,
    accent: "#356b52",
    swatch: "linear-gradient(135deg,#1f3a30,#5d4037 55%,#8a9a72)",
  },
  {
    id: "map-3d",
    name: "3D",
    description: "Terrain · buildings · depth",
    url: MAPBOX_3D_STYLE,
    defaultPitch: 58,
    defaultBearing: -14,
    terrain: true,
    buildings: true,
    accent: "#1b4332",
    swatch: "linear-gradient(135deg,#1b4332,#c5d4c8 70%)",
  },
];

/** Camera point-of-view presets (5 locked + 1 free interactive) */
export type MapPovId =
  | "top"
  | "street"
  | "bird"
  | "cinema"
  | "heading"
  | "free";

export type MapPovPreset = {
  id: MapPovId;
  name: string;
  description: string;
  pitch: number;
  bearing: number;
  /** When true, user can freely tilt / rotate */
  interactive: boolean;
  /** Lock to pure top-down (no pitch) */
  flat?: boolean;
};

export const MAP_POV_PRESETS: MapPovPreset[] = [
  {
    id: "top",
    name: "Top",
    description: "Straight overhead · north-up",
    pitch: 0,
    bearing: 0,
    interactive: false,
    flat: true,
  },
  {
    id: "street",
    name: "Street",
    description: "Street-level tilt",
    pitch: 48,
    bearing: 0,
    interactive: false,
  },
  {
    id: "bird",
    name: "Bird",
    description: "Bird's-eye overview",
    pitch: 62,
    bearing: -18,
    interactive: false,
  },
  {
    id: "cinema",
    name: "Cinema",
    description: "Dramatic low horizon",
    pitch: 72,
    bearing: -32,
    interactive: false,
  },
  {
    id: "heading",
    name: "Heading",
    description: "Forward-facing travel view",
    pitch: 55,
    bearing: -40,
    interactive: false,
  },
  {
    id: "free",
    name: "Free",
    description: "Interactive · drag to look around",
    pitch: 50,
    bearing: -12,
    interactive: true,
  },
];

export function getMapStylePresets(): MapStylePreset[] {
  return MAPBOX_STYLE_PRESETS;
}

export function stylePreset(id: MapStyleId): MapStylePreset {
  return MAPBOX_STYLE_PRESETS.find((s) => s.id === id) || MAPBOX_STYLE_PRESETS[0];
}

export function getMapPovPresets(): MapPovPreset[] {
  return MAP_POV_PRESETS;
}

export function povPreset(id: MapPovId): MapPovPreset {
  return MAP_POV_PRESETS.find((p) => p.id === id) || MAP_POV_PRESETS[0];
}

export function styleKey(style: string): string {
  return style;
}

/** @deprecated use stylePreset */
export type MapBasemap = "map" | "satellite";

export function styleForBasemap(basemap: MapBasemap): string {
  return basemap === "satellite" ? MAPBOX_SATELLITE_STYLE : MAPBOX_STYLE;
}

export function pitchForBasemap(basemap: MapBasemap): number {
  return basemap === "satellite" ? MAP_SATELLITE_PITCH : MAP_PITCH;
}

export function getMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  if (
    !token ||
    token === "YOUR_MAPBOX_PUBLIC_TOKEN" ||
    !token.startsWith("pk.")
  ) {
    return null;
  }
  return token;
}

export function isMapboxConfigured(): boolean {
  return Boolean(getMapboxToken());
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

type StaticMapOptions = {
  lng: number;
  lat: number;
  zoom?: number;
  width?: number;
  height?: number;
  marker?: boolean;
  highDpi?: boolean;
};

export function buildStaticMapUrl(opts: StaticMapOptions): string | null {
  const token = getMapboxToken();
  if (!token) return null;

  const {
    lng,
    lat,
    zoom = 16,
    width = 960,
    height = 540,
    marker = true,
    highDpi = true,
  } = opts;

  const overlay = marker
    ? `pin-l+2f6b4f(${lng.toFixed(5)},${lat.toFixed(5)})/`
    : "";
  const density = highDpi ? "@2x" : "";

  return (
    `https://api.mapbox.com/styles/v1/${MAPBOX_STATIC_STYLE}/static/` +
    `${overlay}${lng.toFixed(5)},${lat.toFixed(5)},${zoom}/` +
    `${width}x${height}${density}?access_token=${encodeURIComponent(token)}`
  );
}

/** Soft green family for category / pin accents */
export const CATEGORY_COLORS: Record<string, string> = {
  "Fresh Produce": "#2f6b4f",
  "Dairy & Eggs": "#3d7a5c",
  Groceries: "#356b52",
  Pantry: "#4a7c59",
  Beverages: "#2d6a4f",
  Snacks: "#52796f",
  "Home & Kitchen": "#3a5a40",
  "Household Essentials": "#405c4a",
  "Health & Wellness (non-prescription)": "#2f5233",
  "General Essentials": "#44624a",
};

export function colorForCategory(category?: string | null): string {
  if (!category) return "#2f6b4f";
  return CATEGORY_COLORS[category] || "#2f6b4f";
}
