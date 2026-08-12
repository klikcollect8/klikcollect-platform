"use client";

/**
 * ActiveLocationContext — the user's chosen "Deliver to" location.
 *
 * A single market-wide selection shared by the header chip, PDP delivery
 * quotes, the cart quote, and checkout's initial value. Persisted to
 * localStorage; seeded from the latest saved checkout pin or the default
 * saved location so returning users don't start from raw GPS every visit.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  LocationConfidence,
  LocationSource,
} from "@/lib/location/types";
import { isValidLatLng } from "@/lib/location/validate";
import { getLatestSavedDeliveryPin } from "@/lib/checkout/saved-delivery-pin";
import { listSavedLocations } from "@/lib/location/saved-locations";

export type ActiveLocation = {
  lat: number;
  lng: number;
  /** Short label for the header chip, e.g. "Westlands, Nairobi" */
  label: string;
  formattedAddress?: string;
  building?: string;
  landmark?: string;
  instructions?: string;
  placeId?: string | null;
  source: LocationSource;
  confidence: LocationConfidence;
  savedLocationId?: string | null;
  setAt: number;
};

const STORAGE_KEY = "klikcollect:active-location";

function readStored(): ActiveLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveLocation;
    if (!isValidLatLng(parsed?.lat, parsed?.lng)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function shortLabel(full: string | null | undefined): string {
  if (!full) return "Set location";
  const parts = full
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.slice(0, 2).join(", ") || full;
}

type ActiveLocationContextValue = {
  active: ActiveLocation | null;
  /** True once localStorage / seed sources have been consulted */
  hydrated: boolean;
  setActive: (next: ActiveLocation) => void;
  clearActive: () => void;
};

const ActiveLocationContext = createContext<ActiveLocationContextValue>({
  active: null,
  hydrated: false,
  setActive: () => {},
  clearActive: () => {},
});

export function ActiveLocationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [active, setActiveState] = useState<ActiveLocation | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate: stored selection → latest checkout pin → default saved location
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setActiveState(stored);
      setHydrated(true);
      return;
    }

    const pin = getLatestSavedDeliveryPin();
    if (pin && isValidLatLng(pin.lat, pin.lng)) {
      setActiveState({
        lat: pin.lat,
        lng: pin.lng,
        label: shortLabel(pin.label || pin.street || pin.area),
        formattedAddress: pin.street || pin.label || undefined,
        building: pin.building || undefined,
        landmark: pin.landmark || undefined,
        instructions: pin.deliveryNote || undefined,
        source: "manual",
        confidence: "user_pinned",
        setAt: pin.savedAt,
      });
      setHydrated(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { locations } = await listSavedLocations();
        if (cancelled) return;
        const preferred =
          locations.find((l) => l.isDefault) || locations[0] || null;
        if (preferred && isValidLatLng(preferred.lat, preferred.lng)) {
          setActiveState({
            lat: preferred.lat,
            lng: preferred.lng,
            label: shortLabel(preferred.formattedAddress || preferred.name),
            formattedAddress: preferred.formattedAddress || undefined,
            building: preferred.building || undefined,
            landmark: preferred.landmark || undefined,
            instructions: preferred.instructions || undefined,
            placeId: preferred.placeId ?? null,
            source: preferred.source,
            confidence: preferred.confidence,
            savedLocationId: preferred.id,
            setAt: preferred.lastUsedAt || preferred.createdAt,
          });
        }
      } catch {
        /* seed is best-effort */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setActive = useCallback((next: ActiveLocation) => {
    if (!isValidLatLng(next.lat, next.lng)) return;
    const value: ActiveLocation = {
      ...next,
      label: next.label || shortLabel(next.formattedAddress),
      setAt: next.setAt || Date.now(),
    };
    setActiveState(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* storage full/blocked — in-memory only */
    }
  }, []);

  const clearActive = useCallback(() => {
    setActiveState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  const ctx = useMemo(
    () => ({ active, hydrated, setActive, clearActive }),
    [active, hydrated, setActive, clearActive],
  );

  return (
    <ActiveLocationContext.Provider value={ctx}>
      {children}
    </ActiveLocationContext.Provider>
  );
}

export function useActiveLocation(): ActiveLocationContextValue {
  return useContext(ActiveLocationContext);
}
