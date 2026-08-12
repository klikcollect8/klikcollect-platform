"use client";

/**
 * BranchLocationEditor — map-based location editing for vendor branches.
 *
 * Replaces raw lat/lng text inputs: search, use current location, stationary
 * pin confirm (via the shared LocationPicker), reverse-geocoded address
 * preview, coordinates readout, "Open in maps", and verification status.
 * Raw coordinate entry survives behind an explicit "Advanced" toggle.
 *
 * Client-side warnings mirror the server checks: missing pin, suspicious
 * (0,0 / placeholder), out-of-Kenya, and near-duplicates of sibling branches.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink, MapPin } from "lucide-react";
import type { LocationPickerResult } from "@/components/location/LocationPicker";
import {
  distanceMeters,
  isInKenyaBbox,
  isSuspiciousCoordinate,
  isValidLatLng,
} from "@/lib/location/validate";
import { googleMapsCoordsUrl } from "@/lib/external-maps";
import { buildStaticMapUrl, getMapboxToken } from "@/lib/mapbox";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

const LocationPicker = dynamic(
  () => import("@/components/location/LocationPicker"),
  { ssr: false },
);

export type BranchLocationValue = {
  lat: number | null;
  lng: number | null;
  placeId?: string | null;
  /** True when the pin was confirmed on the map (not typed manually) */
  locationVerified?: boolean;
  /** Reverse-geocoded label for preview only (not persisted) */
  addressLabel?: string | null;
};

type SiblingBranch = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  value: BranchLocationValue;
  onChange: (next: BranchLocationValue) => void;
  branchName?: string;
  /** Other branches of the same vendor — duplicate detection (< 30 m) */
  siblings?: SiblingBranch[];
  className?: string;
};

const DUPLICATE_RADIUS_M = 30;

export default function BranchLocationEditor({
  value,
  onChange,
  branchName,
  siblings = [],
  className,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [rawLat, setRawLat] = useState(
    value.lat != null ? String(value.lat) : "",
  );
  const [rawLng, setRawLng] = useState(
    value.lng != null ? String(value.lng) : "",
  );

  const hasPin =
    value.lat != null &&
    value.lng != null &&
    isValidLatLng(value.lat, value.lng);
  const hasToken = Boolean(getMapboxToken());

  const warnings = useMemo(() => {
    const out: string[] = [];
    if (!hasPin) {
      out.push(
        "No map pin yet — this branch won't appear in delivery/pickup maps.",
      );
      return out;
    }
    const lat = value.lat as number;
    const lng = value.lng as number;
    if (isSuspiciousCoordinate(lat, lng)) {
      out.push(
        "These coordinates look like a placeholder (0,0 or the default map centre). Drop the pin on the actual branch.",
      );
    } else if (!isInKenyaBbox(lat, lng)) {
      out.push("This pin is outside Kenya — double-check the coordinates.");
    }
    const dup = siblings.find(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        isValidLatLng(s.lat, s.lng) &&
        distanceMeters(lat, lng, s.lat, s.lng) < DUPLICATE_RADIUS_M,
    );
    if (dup) {
      out.push(
        `This pin is within ${DUPLICATE_RADIUS_M} m of "${dup.name}" — is it a duplicate branch?`,
      );
    }
    return out;
  }, [hasPin, value.lat, value.lng, siblings]);

  const staticUrl =
    hasPin && hasToken
      ? buildStaticMapUrl({
          lng: value.lng as number,
          lat: value.lat as number,
          zoom: 16,
          width: 480,
          height: 160,
        })
      : null;

  const applyRaw = () => {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!rawLat.trim() && !rawLng.trim()) {
      onChange({
        lat: null,
        lng: null,
        placeId: null,
        locationVerified: false,
        addressLabel: null,
      });
      return;
    }
    if (!isValidLatLng(lat, lng)) return;
    onChange({
      lat,
      lng,
      placeId: null,
      locationVerified: false,
      addressLabel: null,
    });
  };

  const handlePicked = (r: LocationPickerResult) => {
    setPickerOpen(false);
    setRawLat(String(r.lat));
    setRawLng(String(r.lng));
    onChange({
      lat: r.lat,
      lng: r.lng,
      placeId: r.placeId ?? null,
      locationVerified: true,
      addressLabel: r.formattedAddress || null,
    });
  };

  return (
    <div className={cn("rounded-xl border border-black/10", className)}>
      {staticUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticUrl}
          alt={`Map of ${branchName || "branch"}`}
          width={480}
          height={160}
          loading="lazy"
          className="h-[130px] w-full rounded-t-xl object-cover"
        />
      ) : null}

      <div className="px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-black/40" strokeWidth={1.75} />
            {hasPin ? (
              <span className="text-[13px] tabular-nums text-black/70">
                {(value.lat as number).toFixed(5)},{" "}
                {(value.lng as number).toFixed(5)}
              </span>
            ) : (
              <span className={cn("text-[13px]", osUi.muted)}>
                No pin set
              </span>
            )}
            {hasPin ? (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
                  value.locationVerified
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                {value.locationVerified ? "Map verified" : "Unverified"}
              </span>
            ) : null}
          </div>
          {hasPin ? (
            <a
              href={googleMapsCoordsUrl({
                lat: value.lat as number,
                lng: value.lng as number,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-black/50 underline underline-offset-2 hover:text-black"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
              Open in maps
            </a>
          ) : null}
        </div>

        {value.addressLabel ? (
          <p className={cn("mt-1.5 text-[13px]", osUi.muted)}>
            {value.addressLabel}
          </p>
        ) : null}

        {warnings.map((w) => (
          <p
            key={w}
            className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-2 text-[12px] leading-snug text-amber-950"
          >
            {w}
          </p>
        ))}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className={osUi.btnPrimary}
          >
            {hasPin ? "Adjust pin on map" : "Set location on map"}
          </button>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className={osUi.btnGhost}
          >
            {advanced ? "Hide advanced" : "Advanced"}
          </button>
          {hasPin ? (
            <button
              type="button"
              onClick={() => {
                setRawLat("");
                setRawLng("");
                onChange({
                  lat: null,
                  lng: null,
                  placeId: null,
                  locationVerified: false,
                  addressLabel: null,
                });
              }}
              className={cn(osUi.btnGhost, "text-red-700")}
            >
              Clear pin
            </button>
          ) : null}
        </div>

        {advanced ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              className={osUi.input}
              placeholder="Latitude"
              inputMode="decimal"
              value={rawLat}
              onChange={(e) => setRawLat(e.target.value)}
              aria-label="Latitude"
            />
            <input
              className={osUi.input}
              placeholder="Longitude"
              inputMode="decimal"
              value={rawLng}
              onChange={(e) => setRawLng(e.target.value)}
              aria-label="Longitude"
            />
            <button
              type="button"
              onClick={applyRaw}
              className={osUi.btnGhost}
            >
              Apply
            </button>
          </div>
        ) : null}
      </div>

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePicked}
        context="vendor_branch"
        title={
          branchName ? `Where is ${branchName}?` : "Where is this branch?"
        }
        confirmLabel="Set branch location"
        collectDetails={false}
        allowSave={false}
        showShortcuts={false}
        initial={
          hasPin
            ? {
                lat: value.lat,
                lng: value.lng,
                formattedAddress: value.addressLabel || undefined,
              }
            : null
        }
      />
    </div>
  );
}
