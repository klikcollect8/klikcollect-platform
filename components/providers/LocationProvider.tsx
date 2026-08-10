"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "klikcollect:user-location";
/** Prefer fresh, high-accuracy GPS for delivery quoting. */
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1_500,
  timeout: 18_000,
};
/** Ignore noisy fixes when we already have a tighter reading nearby. */
const ACCURACY_ACCEPT_M = 120;
const ACCURACY_IMPROVE_M = 25;
const MOVE_ACCEPT_M = 18;

export type UserCoords = {
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: number;
};

type LocationStatus =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "error"
  | "unsupported";

type LocationContextValue = {
  coords: UserCoords | null;
  status: LocationStatus;
  error: string | null;
  /** Request / refresh GPS and keep watching */
  track: () => void;
  /** Stop watching (keeps last coords) */
  stop: () => void;
  isTracking: boolean;
};

const LocationContext = createContext<LocationContextValue | null>(null);

function readCached(): UserCoords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserCoords;
    if (
      typeof parsed?.lat === "number" &&
      typeof parsed?.lng === "number" &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCached(coords: UserCoords) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {
    /* ignore */
  }
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const cached = readCached();
    if (cached) {
      setCoords(cached);
      setStatus("ready");
    }
    return () => {
      mountedRef.current = false;
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const applyPosition = useCallback((pos: GeolocationPosition) => {
    if (!mountedRef.current) return;
    const next: UserCoords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      updatedAt: Date.now(),
    };

    setCoords((prev) => {
      if (!prev) {
        writeCached(next);
        return next;
      }
      const accuracy = next.accuracy ?? 999;
      const prevAccuracy = prev.accuracy ?? 999;
      const movedM = haversineMeters(
        prev.lat,
        prev.lng,
        next.lat,
        next.lng,
      );
      const improved =
        accuracy + ACCURACY_IMPROVE_M < prevAccuracy ||
        (accuracy <= ACCURACY_ACCEPT_M && accuracy <= prevAccuracy);
      const relocated = movedM >= MOVE_ACCEPT_M && accuracy <= Math.max(prevAccuracy, 80);
      const stale = Date.now() - prev.updatedAt > 45_000;

      // Keep the better pin when the new fix is vague and nearby.
      if (!stale && !relocated && !improved && accuracy > ACCURACY_ACCEPT_M) {
        return prev;
      }
      writeCached(next);
      return next;
    });
    setStatus("ready");
    setError(null);
  }, []);

  const applyError = useCallback((err: GeolocationPositionError) => {
    if (!mountedRef.current) return;
    if (err.code === err.PERMISSION_DENIED) {
      setStatus("denied");
      setError("Location permission denied");
    } else {
      setStatus("error");
      setError(err.message || "Unable to read location");
    }
    setIsTracking(false);
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const track = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setError("Geolocation is not supported on this device");
      return;
    }

    stop();
    setStatus("locating");
    setError(null);
    setIsTracking(true);

    navigator.geolocation.getCurrentPosition(
      applyPosition,
      applyError,
      WATCH_OPTIONS,
    );
    watchIdRef.current = navigator.geolocation.watchPosition(
      applyPosition,
      applyError,
      WATCH_OPTIONS,
    );
  }, [applyError, applyPosition, stop]);

  /** Do not auto-start GPS — only load cached coords. Call track() from checkout/maps. */
  // (intentionally no mount-time track())

  const value = useMemo<LocationContextValue>(
    () => ({ coords, status, error, track, stop, isTracking }),
    [coords, status, error, track, stop, isTracking],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useUserLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useUserLocation must be used within LocationProvider");
  }
  return ctx;
}
