"use client";

/**
 * Pin-correction signals. When a user moves the pin away from a
 * provider-geocoded location we record BOTH coordinates (best-effort).
 * The provider's canonical location is never overwritten — this data lets
 * the platform learn which addresses geocode poorly.
 */

import { distanceMeters } from "@/lib/location/validate";

/** Minimum pin move (metres) that counts as a correction signal. */
export const CORRECTION_THRESHOLD_M = 25;

export type LocationCorrectionInput = {
  context: "checkout" | "saved_location" | "vendor_branch";
  providerLat: number;
  providerLng: number;
  correctedLat: number;
  correctedLng: number;
  providerLabel?: string;
  placeId?: string | null;
  storeId?: string | null;
};

/**
 * Record a correction when the moved pin is far enough from the provider
 * geocode. Fire-and-forget; never blocks the UX.
 */
export function maybeRecordCorrection(input: LocationCorrectionInput): void {
  const distance = distanceMeters(
    input.providerLat,
    input.providerLng,
    input.correctedLat,
    input.correctedLng,
  );
  if (!Number.isFinite(distance) || distance < CORRECTION_THRESHOLD_M) return;

  try {
    void fetch("/api/location/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: input.context,
        providerLat: input.providerLat,
        providerLng: input.providerLng,
        correctedLat: input.correctedLat,
        correctedLng: input.correctedLng,
        providerLabel: input.providerLabel || null,
        placeId: input.placeId || null,
        storeId: input.storeId || null,
        distanceM: Math.round(distance),
      }),
    }).catch(() => {});
  } catch {
    /* best effort */
  }
}
