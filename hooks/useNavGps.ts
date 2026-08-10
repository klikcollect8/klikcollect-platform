"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NavGpsFix = {
  lat: number;
  lng: number;
  /** meters/second from Geolocation API */
  speedMps: number | null;
  /** degrees from north, if available */
  heading: number | null;
  accuracyM: number | null;
  updatedAt: number;
};

type Options = {
  enabled?: boolean;
};

/**
 * High-accuracy GPS watch for turn-by-turn navigation (speed + heading).
 */
export function useNavGps({ enabled = true }: Options = {}) {
  const [fix, setFix] = useState<NavGpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location not supported on this device");
      return;
    }
    stop();
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        let h =
          heading != null && Number.isFinite(heading) && heading >= 0
            ? heading
            : null;
        if (h == null && lastHeadingRef.current != null) {
          h = lastHeadingRef.current;
        }
        if (h != null) lastHeadingRef.current = h;

        setFix({
          lat: latitude,
          lng: longitude,
          speedMps: speed != null && speed >= 0 ? speed : null,
          heading: h,
          accuracyM: accuracy != null ? accuracy : null,
          updatedAt: Date.now(),
        });
        setReady(true);
        setError(null);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied"
            : "Waiting for GPS…",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 20_000,
      },
    );
  }, [stop]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    start();
    return stop;
  }, [enabled, start, stop]);

  return { fix, error, ready, start, stop };
}
