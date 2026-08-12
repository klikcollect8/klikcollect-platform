"use client";

/**
 * Unified saved-location store.
 *
 * - Signed in: reads/writes DB via /api/user/locations (cross-device).
 * - Signed out / offline: localStorage fallback under a unified key.
 * - One-time migration folds legacy stores (`user_addresses` postal
 *   addresses and `klikcollect:delivery-pins`) into the unified shape.
 *   Legacy keys are left in place for back-compat readers.
 *
 * The DELIVERY PIN (lat/lng) is authoritative; the ADDRESS fields are
 * descriptive; addressLat/addressLng preserve the provider geocode.
 */

import type {
  LocationConfidence,
  LocationSource,
  LocationVerification,
} from "@/lib/location/types";
import { isValidLatLng } from "@/lib/location/validate";
import { listSavedDeliveryPins } from "@/lib/checkout/saved-delivery-pin";
import { loadAddresses } from "@/lib/account-storage";

export type SavedLocation = {
  id: string;
  name: string;
  label: "home" | "work" | "other";
  /** Authoritative delivery point */
  lat: number;
  lng: number;
  /** Provider geocode preserved separately from the pin */
  addressLat?: number | null;
  addressLng?: number | null;
  formattedAddress: string;
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  neighbourhood?: string;
  estate?: string;
  building?: string;
  floor?: string;
  unit?: string;
  landmark?: string;
  instructions?: string;
  city?: string;
  county?: string;
  country?: string;
  postalCode?: string;
  placeId?: string | null;
  source: LocationSource;
  confidence: LocationConfidence;
  verification: LocationVerification;
  isDefault: boolean;
  lastUsedAt?: number | null;
  createdAt: number;
};

const LOCAL_KEY = "klikcollect:saved-locations";
const MIGRATED_KEY = "klikcollect:saved-locations-migrated";

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function newId() {
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitize(raw: unknown): SavedLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lat = typeof r.lat === "number" ? r.lat : Number(r.lat);
  const lng = typeof r.lng === "number" ? r.lng : Number(r.lng);
  if (!isValidLatLng(lat, lng)) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : newId(),
    name: typeof r.name === "string" && r.name ? r.name : "Saved location",
    label:
      r.label === "home" || r.label === "work" ? r.label : ("other" as const),
    lat,
    lng,
    addressLat: typeof r.addressLat === "number" ? r.addressLat : null,
    addressLng: typeof r.addressLng === "number" ? r.addressLng : null,
    formattedAddress:
      typeof r.formattedAddress === "string" ? r.formattedAddress : "",
    addressLine1: typeof r.addressLine1 === "string" ? r.addressLine1 : undefined,
    addressLine2: typeof r.addressLine2 === "string" ? r.addressLine2 : undefined,
    street: typeof r.street === "string" ? r.street : undefined,
    neighbourhood:
      typeof r.neighbourhood === "string" ? r.neighbourhood : undefined,
    estate: typeof r.estate === "string" ? r.estate : undefined,
    building: typeof r.building === "string" ? r.building : undefined,
    floor: typeof r.floor === "string" ? r.floor : undefined,
    unit: typeof r.unit === "string" ? r.unit : undefined,
    landmark: typeof r.landmark === "string" ? r.landmark : undefined,
    instructions:
      typeof r.instructions === "string" ? r.instructions : undefined,
    city: typeof r.city === "string" ? r.city : undefined,
    county: typeof r.county === "string" ? r.county : undefined,
    country: typeof r.country === "string" ? r.country : "KE",
    postalCode: typeof r.postalCode === "string" ? r.postalCode : undefined,
    placeId: typeof r.placeId === "string" ? r.placeId : null,
    source: isSource(r.source) ? r.source : "unknown",
    confidence: isConfidence(r.confidence) ? r.confidence : "manual",
    verification: isVerification(r.verification) ? r.verification : "unverified",
    isDefault: r.isDefault === true,
    lastUsedAt: typeof r.lastUsedAt === "number" ? r.lastUsedAt : null,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
  };
}

function isSource(v: unknown): v is LocationSource {
  return (
    v === "mapbox" || v === "gps" || v === "manual" || v === "seed" || v === "unknown"
  );
}

function isConfidence(v: unknown): v is LocationConfidence {
  return (
    v === "high" ||
    v === "medium" ||
    v === "low" ||
    v === "user_pinned" ||
    v === "gps_verified" ||
    v === "provider_resolved" ||
    v === "manual"
  );
}

function isVerification(v: unknown): v is LocationVerification {
  return (
    v === "unverified" ||
    v === "user_pinned" ||
    v === "gps_verified" ||
    v === "admin_verified"
  );
}

/* -------------------------------------------------------------------------- */
/* Local storage layer                                                        */
/* -------------------------------------------------------------------------- */

function readLocal(): SavedLocation[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitize).filter(Boolean) as SavedLocation[];
  } catch {
    return [];
  }
}

function writeLocal(items: SavedLocation[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

/**
 * Fold legacy localStorage stores into the unified shape once.
 * Legacy keys are NOT removed (older readers still exist).
 */
export function migrateLegacyLocations(): SavedLocation[] {
  if (!canUseStorage()) return [];
  const existing = readLocal();
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return existing;
  } catch {
    return existing;
  }

  const migrated: SavedLocation[] = [...existing];
  const hasNear = (lat: number, lng: number) =>
    migrated.some(
      (l) => Math.abs(l.lat - lat) < 1e-5 && Math.abs(l.lng - lng) < 1e-5,
    );

  // Legacy postal addresses (only those with a usable pin)
  for (const addr of loadAddresses()) {
    if (
      typeof addr.lat !== "number" ||
      typeof addr.lng !== "number" ||
      !isValidLatLng(addr.lat, addr.lng) ||
      hasNear(addr.lat, addr.lng)
    ) {
      continue;
    }
    migrated.push({
      id: `mig_addr_${addr.id}`,
      name: addr.name || "Saved address",
      label: addr.label || "other",
      lat: addr.lat,
      lng: addr.lng,
      formattedAddress: [addr.street, addr.city].filter(Boolean).join(", "),
      street: addr.street || undefined,
      unit: addr.unit || undefined,
      city: addr.city || undefined,
      country: addr.country || "KE",
      postalCode: addr.zip || undefined,
      instructions: addr.notes || undefined,
      source: "manual",
      confidence: "manual",
      verification: "unverified",
      isDefault: addr.isDefault === true,
      createdAt: Date.now(),
    });
  }

  // Legacy checkout delivery pins (most recent few)
  for (const pin of listSavedDeliveryPins().slice(0, 5)) {
    if (!isValidLatLng(pin.lat, pin.lng) || hasNear(pin.lat, pin.lng)) continue;
    migrated.push({
      id: `mig_pin_${pin.id}`,
      name: pin.label || "Delivery pin",
      label: "other",
      lat: pin.lat,
      lng: pin.lng,
      formattedAddress: [pin.street, pin.area].filter(Boolean).join(", "),
      street: pin.street || undefined,
      building: pin.building || undefined,
      neighbourhood: pin.area || undefined,
      landmark: pin.landmark || undefined,
      instructions: pin.deliveryNote || undefined,
      source: pin.source === "gps" ? "gps" : "manual",
      confidence: pin.source === "gps" ? "gps_verified" : "user_pinned",
      verification: pin.source === "gps" ? "gps_verified" : "user_pinned",
      isDefault: false,
      lastUsedAt: pin.savedAt,
      createdAt: pin.savedAt,
    });
  }

  writeLocal(migrated);
  try {
    localStorage.setItem(MIGRATED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  return migrated;
}

/* -------------------------------------------------------------------------- */
/* Remote (DB) layer                                                          */
/* -------------------------------------------------------------------------- */

async function fetchRemote(): Promise<SavedLocation[] | null> {
  try {
    const res = await fetch("/api/user/locations", { cache: "no-store" });
    if (res.status === 401) return null; // signed out — local fallback
    if (!res.ok) return null;
    const data = (await res.json()) as { locations?: unknown[] };
    return (data.locations || [])
      .map(sanitize)
      .filter(Boolean) as SavedLocation[];
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export type SavedLocationInput = Omit<
  SavedLocation,
  "id" | "createdAt" | "isDefault"
> & { id?: string; isDefault?: boolean };

/**
 * List saved locations. Tries DB first (signed in), falls back to the
 * unified localStorage store (running legacy migration on first use).
 */
export async function listSavedLocations(): Promise<{
  locations: SavedLocation[];
  remote: boolean;
}> {
  const remote = await fetchRemote();
  if (remote) return { locations: remote, remote: true };
  return { locations: migrateLegacyLocations(), remote: false };
}

/** Create or update a saved location (DB when signed in, else local). */
export async function upsertSavedLocation(
  input: SavedLocationInput,
): Promise<SavedLocation> {
  const record: SavedLocation = {
    ...input,
    id: input.id || newId(),
    isDefault: input.isDefault === true,
    createdAt: Date.now(),
  };

  // Local-only ids (loc_/mig_ prefixes) don't exist in the DB — create there.
  const isDbId =
    !!input.id && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.id);

  try {
    const res = await fetch("/api/user/locations", {
      method: isDbId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (res.ok) {
      const data = (await res.json()) as { location?: unknown };
      const saved = sanitize(data.location);
      if (saved) return saved;
    }
    if (res.status !== 401) {
      // Server rejected (validation) — surface to caller
      if (!res.ok && res.status !== 404) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message || "Could not save location");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message !== "Failed to fetch") throw err;
  }

  // Local fallback
  const items = migrateLegacyLocations().filter((l) => l.id !== record.id);
  writeLocal([record, ...items]);
  return record;
}

/** Delete a saved location by id (DB + local mirror). */
export async function deleteSavedLocation(id: string): Promise<void> {
  try {
    await fetch(`/api/user/locations?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    /* signed out / offline */
  }
  writeLocal(readLocal().filter((l) => l.id !== id));
}

/** Mark a saved location as used now (ranking freshness). */
export async function touchSavedLocation(id: string): Promise<void> {
  try {
    await fetch("/api/user/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, lastUsedAt: Date.now() }),
    });
  } catch {
    /* best effort */
  }
  const items = readLocal();
  const idx = items.findIndex((l) => l.id === id);
  if (idx >= 0) {
    items[idx] = { ...items[idx], lastUsedAt: Date.now() };
    writeLocal(items);
  }
}
