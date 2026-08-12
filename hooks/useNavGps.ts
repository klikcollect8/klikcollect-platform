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
/** Reject a new fix worse than this when a tighter recent fix exists. */
const NAV_ACCURACY_GATE_M = 150;
/** A previous fix older than this is replaced regardless of accuracy. */
const NAV_FIX_FRESH_MS = 15_000;

export function useNavGps({ enabled = true }: Options = {}) {
  const [fix, setFix] = useState<NavGpsFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const lastFixRef = useRef<NavGpsFix | null>(null);

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

        // Accuracy gate: ignore very loose fixes while a tight recent fix
        // exists — prevents the nav camera jumping on noisy readings.
        const prev = lastFixRef.current;
        const accM = accuracy != null && Number.isFinite(accuracy) ? accuracy : null;
        if (
          prev &&
          accM != null &&
          accM > NAV_ACCURACY_GATE_M &&
          prev.accuracyM != null &&
          prev.accuracyM <= NAV_ACCURACY_GATE_M &&
          Date.now() - prev.updatedAt < NAV_FIX_FRESH_MS
        ) {
          return;
        }

        let h =
          heading != null && Number.isFinite(heading) && heading >= 0
            ? heading
            : null;
        if (h == null && lastHeadingRef.current != null) {
          h = lastHeadingRef.current;
        }
        if (h != null) lastHeadingRef.current = h;

        const next: NavGpsFix = {
          lat: latitude,
          lng: longitude,
          speedMps: speed != null && speed >= 0 ? speed : null,
          heading: h,
          accuracyM: accM,
          updatedAt: Date.now(),
        };
        lastFixRef.current = next;
        setFix(next);
        setReady(true);
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission denied");
          // Permission will not recover mid-session — stop burning battery.
          stop();
          return;
        }
        setError("Waiting for GPS…");
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
