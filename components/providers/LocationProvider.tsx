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
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 12_000,
};

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
    setCoords(next);
    writeCached(next);
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

  /** Auto-start tracking once on mount (browser will prompt if needed). */
  useEffect(() => {
    track();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

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
