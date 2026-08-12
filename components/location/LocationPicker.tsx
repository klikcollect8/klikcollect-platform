"use client";

/**
 * LocationPicker — the single reusable location entry flow:
 *
 *   SEARCH → SELECT → VERIFY (stationary pin over moving map) → DETAILS → SAVE
 *
 * Built on the existing primitives (MapCanvas, MapSearchBox, LocationProvider)
 * and the location infrastructure (provider cache/latest-wins, confidence
 * model, corrections). Renders as a full-screen modal: bottom sheet on
 * mobile, side panel + map on desktop. Fully operable without the map —
 * search, read the resolved address, edit fields, confirm.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type mapboxgl from "mapbox-gl";
import {
  isMapboxConfigured,
  NAIROBI_CENTER,
} from "@/lib/mapbox";
import {
  latestWins,
  reverseGeocodeLocation,
} from "@/lib/location/provider";
import {
  confidenceFromGpsAccuracy,
  confidenceMessage,
  type LocationConfidence,
  type LocationSource,
} from "@/lib/location/types";
import { distanceMeters, isValidLatLng } from "@/lib/location/validate";
import { maybeRecordCorrection } from "@/lib/location/corrections";
import {
  listSavedLocations,
  touchSavedLocation,
  upsertSavedLocation,
  type SavedLocation,
} from "@/lib/location/saved-locations";
import {
  listRecentDestinations,
  pushRecentDestination,
  type RecentDestination,
} from "@/lib/nav/recent-destinations";
import { useUserLocation } from "@/components/providers/LocationProvider";
import MapSearchBox from "@/components/map/MapSearchBox";
import LocationConfidenceBadge from "@/components/location/LocationConfidenceBadge";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
});

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type LocationPickerResult = {
  /** Authoritative delivery/branch point (the pin) */
  lat: number;
  lng: number;
  /** Descriptive address (reverse-geocoded or searched) */
  formattedAddress: string;
  street?: string;
  neighbourhood?: string;
  building?: string;
  floor?: string;
  unit?: string;
  estate?: string;
  landmark?: string;
  instructions?: string;
  placeId?: string | null;
  /** Provider geocode preserved separately from the pin */
  addressLat?: number | null;
  addressLng?: number | null;
  source: LocationSource;
  confidence: LocationConfidence;
  /** Set when the user saved this as a named location */
  savedLocationId?: string | null;
  savedName?: string | null;
};

type PickerContext = "checkout" | "saved_location" | "vendor_branch";

type LocationPickerProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: LocationPickerResult) => void;
  /** Pre-seed the pin (editing an existing location) */
  initial?: {
    lat?: number | null;
    lng?: number | null;
    formattedAddress?: string;
    building?: string;
    floor?: string;
    unit?: string;
    estate?: string;
    landmark?: string;
    instructions?: string;
    name?: string;
    savedLocationId?: string | null;
  } | null;
  title?: string;
  confirmLabel?: string;
  /** Show the building/landmark/instructions step (default true) */
  collectDetails?: boolean;
  /** Offer "save as" with a custom name (default true for checkout/saved) */
  allowSave?: boolean;
  /** Where the picker is used — drives correction context + copy */
  context?: PickerContext;
  /** Hide saved/recent shortcuts (e.g. vendor branch editing) */
  showShortcuts?: boolean;
};

type Step = "search" | "pin" | "details";

/** Single-breakpoint media query hook (md = 768px). */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

type PinState = {
  lat: number;
  lng: number;
  source: LocationSource;
  confidence: LocationConfidence;
  /** Provider geocode that produced this pin (for corrections) */
  providerLat?: number | null;
  providerLng?: number | null;
  providerLabel?: string;
  placeId?: string | null;
};

const PIN_ZOOM = 17;

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function LocationPicker({
  open,
  onClose,
  onConfirm,
  initial,
  title = "Where should we deliver?",
  confirmLabel = "Confirm location",
  collectDetails = true,
  allowSave = true,
  context = "checkout",
  showShortcuts = true,
}: LocationPickerProps) {
  const hasInitialPin =
    initial &&
    typeof initial.lat === "number" &&
    typeof initial.lng === "number" &&
    isValidLatLng(initial.lat, initial.lng);

  const [step, setStep] = useState<Step>(hasInitialPin ? "pin" : "search");
  const [pin, setPin] = useState<PinState | null>(
    hasInitialPin
      ? {
          lat: initial!.lat as number,
          lng: initial!.lng as number,
          source: "manual",
          confidence: "user_pinned",
        }
      : null,
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(
    initial?.formattedAddress || "",
  );
  const [resolving, setResolving] = useState(false);
  const [reverseFailed, setReverseFailed] = useState(false);
  const [cameraNonce, setCameraNonce] = useState(0);
  const [mapMoving, setMapMoving] = useState(false);

  // Details fields
  const [building, setBuilding] = useState(initial?.building || "");
  const [landmark, setLandmark] = useState(initial?.landmark || "");
  const [instructions, setInstructions] = useState(initial?.instructions || "");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [floor, setFloor] = useState(initial?.floor || "");
  const [estate, setEstate] = useState(initial?.estate || "");
  const [moreDetails, setMoreDetails] = useState(false);

  // Save-as
  const [saveAs, setSaveAs] = useState(false);
  const [saveName, setSaveName] = useState(initial?.name || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Shortcuts
  const [saved, setSaved] = useState<SavedLocation[]>([]);
  const [recents, setRecents] = useState<RecentDestination[]>([]);

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pinRef = useRef<PinState | null>(pin);
  pinRef.current = pin;
  const moveEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseAbort = useRef<AbortController | null>(null);

  const {
    coords: gpsCoords,
    status: gpsStatus,
    error: gpsError,
    track,
    stop: stopGps,
  } = useUserLocation();
  const [gpsRequested, setGpsRequested] = useState(false);

  const mapboxReady = isMapboxConfigured();

  /* ------------------------------ lifecycle ------------------------------ */

  useEffect(() => {
    if (!open) return;
    // Body scroll lock
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (showShortcuts) {
      void listSavedLocations().then(({ locations }) => setSaved(locations));
      setRecents(listRecentDestinations().slice(0, 5));
    }
    return () => {
      document.body.style.overflow = prev;
      if (moveEndTimer.current) clearTimeout(moveEndTimer.current);
      reverseAbort.current?.abort();
    };
  }, [open, showShortcuts]);

  // GPS flow: when requested and a fix arrives, move the pin there.
  useEffect(() => {
    if (!gpsRequested || !gpsCoords) return;
    if (gpsStatus !== "ready" && gpsStatus !== "low_accuracy") return;
    setGpsRequested(false);
    stopGps();
    applyPin(
      {
        lat: gpsCoords.lat,
        lng: gpsCoords.lng,
        source: "gps",
        confidence: confidenceFromGpsAccuracy(gpsCoords.accuracy),
      },
      { recenter: true, goToPin: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsRequested, gpsCoords, gpsStatus]);

  /* ------------------------------- pin core ------------------------------ */

  const runReverseGeocode = useCallback((lat: number, lng: number) => {
    const fresh = latestWins("location-picker-reverse");
    reverseAbort.current?.abort();
    const controller = new AbortController();
    reverseAbort.current = controller;
    setResolving(true);
    setReverseFailed(false);

    reverseGeocodeLocation(lng, lat, { signal: controller.signal })
      .then((result) => {
        if (!fresh()) return;
        setResolving(false);
        if (result) {
          setResolvedAddress(result.label);
          setPin((prev) =>
            prev
              ? {
                  ...prev,
                  placeId: result.placeId ?? prev.placeId ?? null,
                }
              : prev,
          );
        } else {
          // Keep the coordinate — the pin is authoritative even when the
          // provider can't describe it.
          setReverseFailed(true);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!fresh()) return;
        setResolving(false);
        setReverseFailed(true);
      });
  }, []);

  const applyPin = useCallback(
    (
      next: PinState,
      opts?: { recenter?: boolean; goToPin?: boolean; skipReverse?: boolean },
    ) => {
      setPin(next);
      if (opts?.goToPin) setStep("pin");
      if (opts?.recenter) setCameraNonce((n) => n + 1);
      if (!opts?.skipReverse) runReverseGeocode(next.lat, next.lng);
    },
    [runReverseGeocode],
  );

  // Reverse geocode the initial pin once when opening in pin mode.
  useEffect(() => {
    if (!open || !hasInitialPin || resolvedAddress) return;
    runReverseGeocode(initial!.lat as number, initial!.lng as number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ------------------------------ map events ----------------------------- */

  const handleMapReady = useCallback(
    (map: mapboxgl.Map) => {
      mapRef.current = map;
      const onMoveStart = () => setMapMoving(true);
      const onMoveEnd = () => {
        setMapMoving(false);
        const c = map.getCenter();
        const current = pinRef.current;
        if (!current) return;
        // Ignore programmatic recenters that land on the same coordinate.
        if (
          Math.abs(c.lat - current.lat) < 1e-7 &&
          Math.abs(c.lng - current.lng) < 1e-7
        ) {
          return;
        }
        const moved: PinState = {
          ...current,
          lat: c.lat,
          lng: c.lng,
          source: "manual",
          confidence: "user_pinned",
        };
        setPin(moved);
        // Correction signal: pin moved away from a provider geocode.
        if (
          typeof current.providerLat === "number" &&
          typeof current.providerLng === "number"
        ) {
          maybeRecordCorrection({
            context,
            providerLat: current.providerLat,
            providerLng: current.providerLng,
            correctedLat: c.lat,
            correctedLng: c.lng,
            providerLabel: current.providerLabel,
            placeId: current.placeId,
          });
        }
        if (moveEndTimer.current) clearTimeout(moveEndTimer.current);
        moveEndTimer.current = setTimeout(() => {
          runReverseGeocode(c.lat, c.lng);
        }, 400);
      };
      map.on("movestart", onMoveStart);
      map.on("moveend", onMoveEnd);
    },
    [context, runReverseGeocode],
  );

  /* ------------------------------- actions ------------------------------- */

  const handleSearchSelect = useCallback(
    (hit: { lng: number; lat: number; name: string; fullAddress: string; mapboxId: string; featureType: string }) => {
      applyPin(
        {
          lat: hit.lat,
          lng: hit.lng,
          source: "mapbox",
          confidence:
            hit.featureType === "address" || hit.featureType === "poi"
              ? "high"
              : "medium",
          providerLat: hit.lat,
          providerLng: hit.lng,
          providerLabel: hit.fullAddress || hit.name,
          placeId: hit.mapboxId,
        },
        { recenter: true, goToPin: true, skipReverse: true },
      );
      setResolvedAddress(hit.fullAddress || hit.name);
    },
    [applyPin],
  );

  const handleUseGps = useCallback(() => {
    setGpsRequested(true);
    track();
  }, [track]);

  const handleUseSaved = useCallback(
    (loc: SavedLocation) => {
      void touchSavedLocation(loc.id);
      onConfirm({
        lat: loc.lat,
        lng: loc.lng,
        formattedAddress: loc.formattedAddress,
        street: loc.street,
        neighbourhood: loc.neighbourhood,
        building: loc.building,
        floor: loc.floor,
        unit: loc.unit,
        estate: loc.estate,
        landmark: loc.landmark,
        instructions: loc.instructions,
        placeId: loc.placeId,
        addressLat: loc.addressLat,
        addressLng: loc.addressLng,
        source: loc.source,
        confidence: loc.confidence,
        savedLocationId: loc.id,
        savedName: loc.name,
      });
    },
    [onConfirm],
  );

  const handleUseRecent = useCallback(
    (dest: RecentDestination) => {
      applyPin(
        {
          lat: dest.lat,
          lng: dest.lng,
          source: "manual",
          confidence: "medium",
        },
        { recenter: true, goToPin: true },
      );
      setResolvedAddress(dest.label);
    },
    [applyPin],
  );

  const finish = useCallback(async () => {
    if (!pin) return;
    const result: LocationPickerResult = {
      lat: pin.lat,
      lng: pin.lng,
      formattedAddress:
        resolvedAddress ||
        `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
      building: building.trim() || undefined,
      floor: floor.trim() || undefined,
      unit: unit.trim() || undefined,
      estate: estate.trim() || undefined,
      landmark: landmark.trim() || undefined,
      instructions: instructions.trim() || undefined,
      placeId: pin.placeId ?? null,
      addressLat: pin.providerLat ?? null,
      addressLng: pin.providerLng ?? null,
      source: pin.source,
      confidence: pin.confidence,
      savedLocationId: initial?.savedLocationId ?? null,
      savedName: null,
    };

    pushRecentDestination({
      label: result.formattedAddress,
      lng: pin.lng,
      lat: pin.lat,
    });

    if (allowSave && saveAs) {
      setSaving(true);
      setSaveError(null);
      try {
        const savedLoc = await upsertSavedLocation({
          id: initial?.savedLocationId || undefined,
          name: saveName.trim() || result.formattedAddress.slice(0, 60),
          label: "other",
          lat: pin.lat,
          lng: pin.lng,
          addressLat: pin.providerLat ?? null,
          addressLng: pin.providerLng ?? null,
          formattedAddress: result.formattedAddress,
          building: result.building,
          floor: result.floor,
          unit: result.unit,
          estate: result.estate,
          landmark: result.landmark,
          instructions: result.instructions,
          placeId: pin.placeId ?? null,
          source: pin.source,
          confidence: pin.confidence,
          verification:
            pin.source === "gps"
              ? "gps_verified"
              : pin.confidence === "user_pinned"
                ? "user_pinned"
                : "unverified",
        });
        result.savedLocationId = savedLoc.id;
        result.savedName = savedLoc.name;
      } catch (err) {
        setSaving(false);
        setSaveError(
          err instanceof Error ? err.message : "Could not save location",
        );
        return;
      }
      setSaving(false);
    }

    onConfirm(result);
  }, [
    pin,
    resolvedAddress,
    building,
    floor,
    unit,
    estate,
    landmark,
    instructions,
    allowSave,
    saveAs,
    saveName,
    initial?.savedLocationId,
    onConfirm,
  ]);

  const handleConfirmPin = useCallback(() => {
    if (!pin) return;
    if (collectDetails) setStep("details");
    else void finish();
  }, [pin, collectDetails, finish]);

  /* ------------------------------- derived ------------------------------- */

  const gpsDistanceLabel = useMemo(() => {
    if (!pin || !gpsCoords) return null;
    const d = distanceMeters(pin.lat, pin.lng, gpsCoords.lat, gpsCoords.lng);
    if (!Number.isFinite(d)) return null;
    if (d < 1000) return `≈ ${Math.round(d)} m from your position`;
    return `≈ ${(d / 1000).toFixed(1)} km from your position`;
  }, [pin, gpsCoords]);

  const gpsBusy =
    gpsRequested &&
    (gpsStatus === "locating" || gpsStatus === "requesting_permission");

  const isDesktop = useIsDesktop();

  const mapCenter = useMemo<[number, number]>(() => {
    if (pin) return [pin.lng, pin.lat];
    return NAIROBI_CENTER;
  }, [pin]);

  if (!open) return null;

  /* -------------------------------- render ------------------------------- */

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/40 md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-white md:h-[min(720px,92vh)] md:w-[min(980px,94vw)] md:flex-row md:rounded-2xl md:shadow-2xl">
        {/* -------------------------- Panel (left) -------------------------- */}
        <div className="flex w-full flex-col md:w-[380px] md:border-r md:border-black/10">
          <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3">
            <h2 className="text-[15px] font-semibold text-black">
              {step === "details" ? "Delivery details" : title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-black/50 hover:bg-black/5"
              aria-label="Close location picker"
            >
              ✕
            </button>
          </div>

          {step === "search" ? (
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-black/60">
                  Search for an address, estate, building or landmark
                </label>
                <MapSearchBox
                  placeholder="Westlands, Garden City Mall, Juja Road…"
                  proximity={
                    gpsCoords
                      ? { lng: gpsCoords.lng, lat: gpsCoords.lat }
                      : null
                  }
                  onSelect={handleSearchSelect}
                />
              </div>

              <button
                type="button"
                onClick={handleUseGps}
                disabled={gpsBusy}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-black/10 px-3 py-2.5 text-left hover:bg-black/[0.03] disabled:opacity-60"
              >
                <span aria-hidden className="text-lg">◎</span>
                <span className="flex-1">
                  <span className="block text-[14px] font-medium text-black">
                    {gpsBusy ? "Locating…" : "Use my current location"}
                  </span>
                  {gpsStatus === "denied" ? (
                    <span className="block text-[12px] text-red-600">
                      Location access is turned off. Try again or enter an
                      address manually.
                    </span>
                  ) : gpsStatus === "low_accuracy" ? (
                    <span className="block text-[12px] text-amber-600">
                      Your location is approximate — you can adjust the pin.
                    </span>
                  ) : gpsStatus === "error" || gpsStatus === "unsupported" ? (
                    <span className="block text-[12px] text-red-600">
                      {gpsError || "GPS unavailable — search instead."}
                    </span>
                  ) : gpsCoords?.accuracy ? (
                    <span className="block text-[12px] text-black/45">
                      Accurate to ±{Math.round(gpsCoords.accuracy)} m
                    </span>
                  ) : null}
                </span>
              </button>

              {showShortcuts && saved.length > 0 ? (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-black/40">
                    Saved locations
                  </p>
                  <div className="space-y-1.5">
                    {saved.slice(0, 5).map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleUseSaved(loc)}
                        className="flex min-h-11 w-full items-start gap-2.5 rounded-xl border border-black/10 px-3 py-2 text-left hover:bg-black/[0.03]"
                      >
                        <span aria-hidden className="mt-0.5">
                          {loc.label === "home"
                            ? "⌂"
                            : loc.label === "work"
                              ? "▣"
                              : "◈"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-black">
                            {loc.name}
                          </span>
                          <span className="block truncate text-[12px] text-black/45">
                            {loc.formattedAddress}
                          </span>
                        </span>
                        <LocationConfidenceBadge
                          confidence={loc.confidence}
                          className="mt-0.5 shrink-0"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showShortcuts && recents.length > 0 ? (
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-black/40">
                    Recent locations
                  </p>
                  <div className="space-y-1.5">
                    {recents.map((dest) => (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => handleUseRecent(dest)}
                        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-black/[0.03]"
                      >
                        <span aria-hidden className="text-black/30">↺</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-black/80">
                            {dest.label}
                          </span>
                          {dest.sub ? (
                            <span className="block truncate text-[11px] text-black/40">
                              {dest.sub}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "pin" ? (
            <div className="flex flex-1 flex-col overflow-y-auto">
              {/* Mobile map (panel-embedded; desktop uses the right pane) */}
              {!isDesktop ? (
                <div className="relative h-[38vh] shrink-0">
                  <PickerMap
                    mapboxReady={mapboxReady}
                    center={mapCenter}
                    cameraNonce={cameraNonce}
                    onReady={handleMapReady}
                    mapMoving={mapMoving}
                    accuracyM={
                      pin?.source === "gps" ? gpsCoords?.accuracy : undefined
                    }
                  />
                </div>
              ) : null}

              <div className="flex-1 space-y-3 px-4 py-4">
                <div>
                  <p className="text-[13px] font-semibold text-black">
                    Is this your {context === "vendor_branch" ? "branch" : "delivery"} location?
                  </p>
                  <p className="mt-0.5 text-[12px] text-black/45">
                    Move the map to place the pin on your exact{" "}
                    {context === "vendor_branch" ? "entrance" : "delivery point"}.
                  </p>
                </div>

                <div className="rounded-xl border border-black/10 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-black">
                        {resolving
                          ? "Resolving address…"
                          : resolvedAddress ||
                            (reverseFailed
                              ? "Address unavailable — pin location kept"
                              : "Move the pin to set a location")}
                      </p>
                      <p className="mt-0.5 text-[11px] tabular-nums text-black/40">
                        {pin
                          ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
                          : ""}
                        {gpsDistanceLabel ? ` · ${gpsDistanceLabel}` : ""}
                      </p>
                    </div>
                    {pin ? (
                      <LocationConfidenceBadge
                        confidence={pin.confidence}
                        className="shrink-0"
                      />
                    ) : null}
                  </div>
                  {pin ? (
                    <p className="mt-1.5 text-[12px] text-black/50">
                      {confidenceMessage(pin.confidence)}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("search")}
                    className="min-h-11 flex-1 rounded-xl border border-black/15 px-4 text-[14px] font-medium text-black hover:bg-black/[0.03]"
                  >
                    Search again
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPin}
                    disabled={!pin || resolving}
                    className="min-h-11 flex-1 rounded-xl bg-black px-4 text-[14px] font-semibold text-white hover:bg-black/85 disabled:opacity-50"
                  >
                    {collectDetails ? "Confirm location" : confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === "details" ? (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-3 px-4 py-4">
                <div className="rounded-xl border border-black/10 px-3 py-2.5">
                  <p className="truncate text-[14px] font-medium text-black">
                    {resolvedAddress || "Selected location"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-[11px] tabular-nums text-black/40">
                      Exact delivery point set
                    </p>
                    {pin ? (
                      <LocationConfidenceBadge confidence={pin.confidence} />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("pin")}
                    className="mt-2 text-[12px] font-medium text-black underline underline-offset-2"
                  >
                    Adjust pin
                  </button>
                </div>

                <Field
                  label="House / building"
                  value={building}
                  onChange={setBuilding}
                  placeholder="e.g. Delta Towers, Gate B"
                />
                <Field
                  label="Landmark"
                  value={landmark}
                  onChange={setLandmark}
                  placeholder="e.g. Blue gate next to Quickmart"
                />
                <Field
                  label="Delivery instructions"
                  value={instructions}
                  onChange={setInstructions}
                  placeholder="e.g. Call when outside"
                  textarea
                />

                {!moreDetails ? (
                  <button
                    type="button"
                    onClick={() => setMoreDetails(true)}
                    className="text-[13px] font-medium text-black/60 underline underline-offset-2"
                  >
                    More details (apartment, floor, estate)
                  </button>
                ) : (
                  <div className="space-y-3">
                    <Field
                      label="Apartment / unit"
                      value={unit}
                      onChange={setUnit}
                      placeholder="e.g. B12"
                    />
                    <Field
                      label="Floor"
                      value={floor}
                      onChange={setFloor}
                      placeholder="e.g. 3rd floor"
                    />
                    <Field
                      label="Estate"
                      value={estate}
                      onChange={setEstate}
                      placeholder="e.g. Nyayo Estate"
                    />
                  </div>
                )}

                {allowSave ? (
                  <div className="rounded-xl border border-black/10 px-3 py-2.5">
                    <label className="flex min-h-9 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={saveAs}
                        onChange={(e) => setSaveAs(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-[13px] font-medium text-black">
                        Save this location
                      </span>
                    </label>
                    {saveAs ? (
                      <input
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder={'Name it — "Home", "Mum\'s house", "Office"'}
                        className="mt-2 w-full rounded-lg border border-black/15 px-3 py-2 text-[13px] outline-none focus:border-black/40"
                        maxLength={60}
                      />
                    ) : null}
                    {saveError ? (
                      <p className="mt-1.5 text-[12px] text-red-600">
                        {saveError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-black/10 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => void finish()}
                  disabled={saving}
                  className="min-h-12 w-full rounded-xl bg-black px-4 text-[15px] font-semibold text-white hover:bg-black/85 disabled:opacity-60"
                >
                  {saving ? "Saving…" : confirmLabel}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* --------------------------- Map (right) -------------------------- */}
        {isDesktop ? (
          <div className="relative flex-1">
            <PickerMap
              mapboxReady={mapboxReady}
              center={mapCenter}
              cameraNonce={cameraNonce}
              onReady={handleMapReady}
              mapMoving={mapMoving}
              showPin={step !== "search" || !!pin}
              accuracyM={pin?.source === "gps" ? gpsCoords?.accuracy : undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-black/60">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          maxLength={500}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-[13px] outline-none focus:border-black/40"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={120}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-[13px] outline-none focus:border-black/40"
        />
      )}
    </label>
  );
}

/** Map surface with a stationary centre pin + optional GPS accuracy ring. */
function PickerMap({
  mapboxReady,
  center,
  cameraNonce,
  onReady,
  mapMoving,
  showPin = true,
  accuracyM,
}: {
  mapboxReady: boolean;
  center: [number, number];
  cameraNonce: number;
  onReady: (map: mapboxgl.Map) => void;
  mapMoving: boolean;
  showPin?: boolean;
  accuracyM?: number | null;
}) {
  const [zoomLevel, setZoomLevel] = useState(PIN_ZOOM);

  const handleReady = useCallback(
    (map: mapboxgl.Map) => {
      map.on("zoom", () => setZoomLevel(map.getZoom()));
      onReady(map);
    },
    [onReady],
  );

  if (!mapboxReady) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-black/[0.03] text-[13px] text-black/45"
        role="img"
        aria-label="Map unavailable — use the search field to set your location"
      >
        Map unavailable — search for your address instead.
      </div>
    );
  }

  // Metres → screen pixels at this latitude/zoom (Web Mercator)
  const accuracyPx =
    accuracyM && accuracyM > 0
      ? Math.min(
          160,
          accuracyM /
            ((156543.03392 * Math.cos((center[1] * Math.PI) / 180)) /
              2 ** zoomLevel),
        )
      : 0;

  return (
    <div
      className="relative h-full w-full"
      role="img"
      aria-label="Map showing the selected delivery location. Move the map to adjust the pin."
    >
      <MapCanvas
        className="h-full w-full"
        center={center}
        zoom={PIN_ZOOM}
        cameraKey={cameraNonce}
        interactive
        flat
        onReady={handleReady}
      />
      {showPin ? (
        <>
          {accuracyPx > 8 ? (
            <span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/40 bg-sky-400/10"
              style={{ width: accuracyPx * 2, height: accuracyPx * 2 }}
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 transition-transform duration-150",
              mapMoving ? "-translate-y-[calc(100%+6px)]" : "-translate-y-full",
            )}
          >
            <span className="block text-[34px] leading-none drop-shadow-md">📍</span>
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60"
          />
        </>
      ) : null}
    </div>
  );
}
