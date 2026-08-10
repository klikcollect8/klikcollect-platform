"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Maximize2, Navigation } from "lucide-react";
import { useUserLocation } from "@/components/providers/LocationProvider";
import SameDayTiming, {
  type TimingMode,
} from "@/components/checkout/SameDayTiming";
import type { CheckoutVendor } from "@/lib/checkout/types";
import type { DeliveryQuote } from "@/lib/checkout/delivery-pricing";
import type { DayWindow } from "@/lib/checkout/same-day-slots";
import { forwardGeocode, reverseGeocode } from "@/lib/mapbox-api";
import {
  buildDeliveryTripRoutes,
  shopLegsToAltGeoJSON,
  type DeliveryTripRoutes,
  type ShopLegRoute,
} from "@/lib/checkout/delivery-routes";
import {
  getLatestSavedDeliveryPin,
  persistAndLogDeliveryPin,
  type SavedDeliveryPin,
} from "@/lib/checkout/saved-delivery-pin";
import {
  formatDistanceKm,
  getMapboxToken,
} from "@/lib/mapbox";
import { formatPrice } from "@/lib/currency";

const AdvancedNavMap = dynamic(
  () => import("@/components/map/AdvancedNavMap"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[200px] items-center justify-center bg-black/[0.03] text-[11px] uppercase tracking-[0.2em] text-black/35">
        Loading map
      </div>
    ),
  },
);

const MapSearchBox = dynamic(() => import("@/components/map/MapSearchBox"), {
  ssr: false,
  loading: () => (
    <div className="h-12 border border-black/10 bg-white/50" />
  ),
});

const CheckoutDeliveryMap = dynamic(
  () => import("@/components/checkout/CheckoutDeliveryMap"),
  { ssr: false },
);

export type DeliveryLocationValue = {
  deliveryArea: string;
  areaOther: string;
  building: string;
  street: string;
  landmark: string;
  lat: number | null;
  lng: number | null;
  label: string;
  gateCode: string;
  deliveryNote: string;
};

type Props = {
  value: DeliveryLocationValue;
  onChange: (next: DeliveryLocationValue) => void;
  vendors: CheckoutVendor[];
  quote: DeliveryQuote | null;
  dayWindow: DayWindow | null;
  timingMode: TimingMode;
  pickupDate: string;
  pickupTime: string;
  onTimingModeChange: (mode: TimingMode) => void;
  onTimingChange: (next: {
    date: string;
    time: string;
    mode: TimingMode;
  }) => void;
};

const fieldClass =
  "h-12 w-full border-0 border-b border-black/15 bg-transparent px-0 text-[15px] outline-none transition-[border-color] placeholder:text-black/30 focus:border-black";

function applyPlace(
  value: DeliveryLocationValue,
  lat: number,
  lng: number,
  place: string | null,
): DeliveryLocationValue {
  const label = place?.trim() || value.label || "Your location";
  const areaHint =
    place?.split(",")[0]?.trim() || value.deliveryArea || "Your location";
  return {
    ...value,
    lat,
    lng,
    street: place || value.street || "",
    label,
    deliveryArea:
      value.deliveryArea &&
      value.deliveryArea !== "westlands" &&
      value.deliveryArea !== "Your location"
        ? value.deliveryArea
        : areaHint,
    areaOther: value.areaOther,
  };
}

function composeAddressQuery(value: DeliveryLocationValue): string {
  return [value.building, value.street, value.landmark, value.deliveryArea === "other" ? value.areaOther : value.deliveryArea, "Nairobi", "Kenya"]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

export default function DeliveryLocationStep({
  value,
  onChange,
  vendors,
  quote,
  dayWindow,
  timingMode,
  pickupDate,
  pickupTime,
  onTimingModeChange,
  onTimingChange,
}: Props) {
  const { coords, status, error, track } = useUserLocation();
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [forceApply, setForceApply] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [tripRoutes, setTripRoutes] = useState<DeliveryTripRoutes | null>(
    null,
  );
  const [routesLoading, setRoutesLoading] = useState(false);
  /** When true, GPS watch won't overwrite a manually chosen pin/address. */
  const [manualOverride, setManualOverride] = useState(false);
  const lastAppliedRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const hasToken = Boolean(getMapboxToken());

  useEffect(() => {
    if (status === "idle") track();
  }, [status, track]);

  // Live GPS → pin (skipped after manual address/map pick until "Use current location")
  useEffect(() => {
    if (!coords) return;
    if (manualOverride && forceApply === 0) return;

    const key = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}:${forceApply}`;
    if (lastAppliedRef.current === key) return;

    let cancelled = false;
    setResolving(true);
    void (async () => {
      try {
        const place = hasToken
          ? await reverseGeocode(coords.lng, coords.lat)
          : null;
        if (cancelled) return;
        lastAppliedRef.current = key;
        setManualOverride(false);
        onChange(applyPlace(valueRef.current, coords.lat, coords.lng, place));
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coords, forceApply, hasToken, onChange, manualOverride]);

  const refreshFromGps = () => {
    setManualOverride(false);
    setGeoError(null);
    setForceApply((n) => n + 1);
    track();
  };

  const persistPin = useCallback(
    (
      lat: number,
      lng: number,
      label: string | null | undefined,
      source: SavedDeliveryPin["source"],
    ) => {
      const v = valueRef.current;
      persistAndLogDeliveryPin({
        lat,
        lng,
        label: label?.trim() || v.label || "Deliver here",
        street: v.street || label?.trim() || "",
        building: v.building || "",
        area:
          v.deliveryArea === "other"
            ? v.areaOther || ""
            : v.deliveryArea || "",
        landmark: v.landmark || "",
        gateCode: v.gateCode || "",
        deliveryNote: v.deliveryNote || "",
        source,
      });
    },
    [],
  );

  const setManualPlace = useCallback(
    async (
      lat: number,
      lng: number,
      label?: string | null,
      source: SavedDeliveryPin["source"] = "map_pin",
    ) => {
      setManualOverride(true);
      setGeoError(null);
      setResolving(true);
      try {
        const place =
          label?.trim() ||
          (hasToken ? await reverseGeocode(lng, lat) : null);
        lastAppliedRef.current = `${lat.toFixed(5)},${lng.toFixed(5)}:manual`;
        onChange(applyPlace(valueRef.current, lat, lng, place));
        persistPin(lat, lng, place, source);
      } finally {
        setResolving(false);
      }
    },
    [hasToken, onChange, persistPin],
  );

  // Restore last saved deliver-here pin when checkout has none yet
  useEffect(() => {
    if (value.lat != null && value.lng != null) return;
    const saved = getLatestSavedDeliveryPin();
    if (!saved) return;
    setManualOverride(true);
    lastAppliedRef.current = `${saved.lat.toFixed(5)},${saved.lng.toFixed(5)}:saved`;
    onChange({
      ...valueRef.current,
      lat: saved.lat,
      lng: saved.lng,
      label: saved.label || valueRef.current.label,
      street: saved.street || valueRef.current.street,
      building: saved.building || valueRef.current.building,
      landmark: saved.landmark || valueRef.current.landmark,
      gateCode: saved.gateCode || valueRef.current.gateCode,
      deliveryNote: saved.deliveryNote || valueRef.current.deliveryNote,
      deliveryArea:
        saved.area || valueRef.current.deliveryArea || "Your location",
    });
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFromAddress = async () => {
    const query = composeAddressQuery(value);
    if (query.replace(/Nairobi|Kenya|,/gi, "").trim().length < 3) {
      setGeoError("Add a street or area so we can place the pin.");
      return;
    }
    if (!hasToken) {
      setGeoError("Map search is unavailable right now.");
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    try {
      const hit = await forwardGeocode(query, {
        lng: value.lng ?? coords?.lng ?? 36.8219,
        lat: value.lat ?? coords?.lat ?? -1.2921,
      });
      if (!hit) {
        setGeoError("Couldn’t find that address — try a clearer street or area.");
        return;
      }
      setManualOverride(true);
      lastAppliedRef.current = `${hit.lat.toFixed(5)},${hit.lng.toFixed(5)}:geo`;
      const next = {
        ...value,
        lat: hit.lat,
        lng: hit.lng,
        street: hit.label || value.street,
        label: hit.label || value.label,
        deliveryArea:
          value.deliveryArea && value.deliveryArea !== "Your location"
            ? value.deliveryArea
            : hit.label.split(",")[0]?.trim() || value.deliveryArea,
      };
      onChange(next);
      persistPin(hit.lat, hit.lng, hit.label, "address_edit");
    } finally {
      setGeocoding(false);
    }
  };

  const shopsKey = useMemo(
    () =>
      vendors
        .filter((v) => v.lat != null && v.lng != null)
        .map(
          (v) =>
            `${v.vendorId}:${(v.lat as number).toFixed(4)},${(v.lng as number).toFixed(4)}`,
        )
        .join("|"),
    [vendors],
  );

  const shopCoords = useMemo(
    () =>
      vendors
        .filter((v) => v.lat != null && v.lng != null)
        .map((v) => ({
          vendorId: v.vendorId,
          name: v.name,
          lat: v.lat as number,
          lng: v.lng as number,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shopsKey],
  );

  // Best driver routes: shop → home (traffic), multi-shop optimized trip
  useEffect(() => {
    if (!hasToken || value.lat == null || value.lng == null) {
      setTripRoutes(null);
      return;
    }
    if (!shopCoords.length) {
      setTripRoutes(null);
      return;
    }

    let cancelled = false;
    setRoutesLoading(true);
    void (async () => {
      try {
        const trip = await buildDeliveryTripRoutes(
          { lng: value.lng as number, lat: value.lat as number },
          shopCoords,
        );
        if (!cancelled) setTripRoutes(trip);
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasToken, value.lat, value.lng, shopsKey, shopCoords]);

  const summary = useMemo(() => {
    const parts = [value.building, value.street || value.label].filter(Boolean);
    if (parts.length) return parts.join(", ");
    if (value.lat != null && value.lng != null) {
      return `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`;
    }
    return "Waiting for GPS…";
  }, [value.building, value.street, value.label, value.lat, value.lng]);

  const pin = useMemo(() => {
    if (value.lng == null || value.lat == null) return null;
    return {
      id: "delivery",
      lng: value.lng,
      lat: value.lat,
      kind: "dropoff" as const,
      label: "Deliver here",
      active: true,
      pulse: true,
    };
  }, [value.lat, value.lng]);

  const markers = useMemo(() => {
    const order = tripRoutes?.stopOrder || [];
    const indexed = vendors
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => {
        const stopIndex = order.indexOf(v.vendorId);
        return {
          id: v.vendorId,
          lat: v.lat as number,
          lng: v.lng as number,
          kind: "stop" as const,
          label: v.name,
          stopIndex: stopIndex >= 0 ? stopIndex + 1 : undefined,
          active: tripRoutes?.shopLegs.some(
            (l) => l.vendorId === v.vendorId && l.isBest,
          ),
        };
      });
    return pin ? [pin, ...indexed] : indexed;
  }, [pin, vendors, tripRoutes]);

  const primaryRoute = tripRoutes?.driverRoute ?? null;
  const altRoutesGeoJSON = useMemo(() => {
    if (!tripRoutes?.shopLegs.length) return null;
    // Multi-shop optimized trip: show every shop→home leg as secondary
    // Single shop: no secondary needed
    if (tripRoutes.shopLegs.length <= 1) return null;
    return shopLegsToAltGeoJSON(tripRoutes.shopLegs);
  }, [tripRoutes]);

  const shopLegs: ShopLegRoute[] = tripRoutes?.shopLegs || [];

  const fitKey = useMemo(() => {
    if (value.lat == null || value.lng == null) return 0;
    const n = vendors.filter((v) => v.lat != null).length;
    return Number(`${value.lat.toFixed(4)}${value.lng.toFixed(4)}${n}`);
  }, [value.lat, value.lng, vendors]);

  const accuracyLabel =
    coords?.accuracy != null && Number.isFinite(coords.accuracy)
      ? coords.accuracy < 1000
        ? `±${Math.round(coords.accuracy)} m`
        : `±${(coords.accuracy / 1000).toFixed(1)} km`
      : null;

  const previewMap = (
    <AdvancedNavMap
      variant="compact"
      className="h-full w-full min-h-[220px]"
      markers={markers.filter((m) => m.id !== "delivery")}
      destination={
        pin
          ? { lng: pin.lng, lat: pin.lat, label: pin.label || "Deliver here" }
          : null
      }
      routeGeoJSON={primaryRoute}
      altRoutesGeoJSON={altRoutesGeoJSON}
      showSearch={false}
      showStyleSwitcher
      showStreetPreview
      showTraffic
      followUserDefault={Boolean(coords)}
      interactive={false}
      fitMarkers={primaryRoute ? false : fitKey || markers.length > 1}
    />
  );

  return (
    <div>
      <h2 className="text-[clamp(1.45rem,3.6vw,1.85rem)] font-semibold tracking-tight">
        Confirm delivery
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-black/45">
        Green line = best driver route (shop pickups → your door). Grey lines =
        each shop’s best path home. Fee updates when the pin moves. Use street
        preview for a pitched ground-level look (not Street View panoramas).
      </p>

      {hasToken ? (
        <div className="mt-8 overflow-hidden border border-black/10">
          <div className="relative h-[240px] sm:h-[300px]">
            {markers.length > 0 ? (
              previewMap
            ) : (
              <AdvancedNavMap
                variant="compact"
                className="h-full w-full"
                showSearch={false}
                showStyleSwitcher
                showStreetPreview
                followUserDefault
                interactive={false}
              />
            )}
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="absolute bottom-14 right-3 z-20 inline-flex items-center gap-1.5 bg-white/95 px-3 py-2 text-[12px] font-medium uppercase tracking-[0.12em] text-black shadow-sm ring-1 ring-black/10 hover:bg-white sm:bottom-3"
            >
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              {markers.length > 0 ? "Enlarge" : "Open map"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-white/40 px-3 py-2.5 text-[12px] text-black/45">
            <span>
              {resolving || status === "locating"
                ? "Finding your location…"
                : routesLoading
                  ? "Finding best driver route…"
                  : tripRoutes?.driverMeta
                    ? `Best driver trip · ${formatDistanceKm(tripRoutes.driverMeta.distanceKm)} · ~${tripRoutes.driverMeta.etaMinutes} min`
                    : markers.length > 0
                      ? "Routes appear when the pin is set"
                      : status === "denied"
                        ? "Location permission off — search or drop a pin"
                        : "Search or drop a pin to set delivery"}
            </span>
            {accuracyLabel && !manualOverride ? (
              <span>GPS {accuracyLabel}</span>
            ) : manualOverride ? (
              <span>Custom pin</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-8 flex h-[140px] items-center justify-center border border-black/10 bg-black/[0.03]">
          <div className="text-center">
            <MapPin className="mx-auto h-5 w-5 text-black/35" strokeWidth={1.5} />
            <p className="mt-2 text-[12px] text-black/40">
              Map preview unavailable — missing Mapbox token
            </p>
          </div>
        </div>
      )}

      {hasToken ? (
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
            Search address
          </p>
          <MapSearchBox
            placeholder="Building, street, estate in Nairobi"
            proximity={
              value.lng != null && value.lat != null
                ? { lng: value.lng, lat: value.lat }
                : coords
                  ? { lng: coords.lng, lat: coords.lat }
                  : null
            }
            onSelect={(hit) => {
              void setManualPlace(
                hit.lat,
                hit.lng,
                hit.fullAddress || hit.name,
                "search",
              );
              setEditing(true);
            }}
          />
        </div>
      ) : null}

      <div className="mt-6 border-y border-black/[0.06] py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
          Deliver to
        </p>
        {value.building ? (
          <p className="mt-2 text-[13px] text-black/45">{value.building}</p>
        ) : null}
        <p className="mt-1 text-[16px] font-medium leading-snug">{summary}</p>
        <p className="mt-1 text-[13px] text-black/40">
          {value.deliveryArea === "other"
            ? value.areaOther || "Custom area"
            : value.deliveryArea || "Your location"}
          {accuracyLabel && status === "ready" && !manualOverride
            ? ` · ${accuracyLabel}`
            : ""}
        </p>
        {value.landmark ? (
          <p className="mt-1 text-[13px] text-black/40">Near {value.landmark}</p>
        ) : null}
        {error && status === "denied" ? (
          <p className="mt-2 text-[12px] text-red-700">
            Location access denied. Search or edit the address for this delivery.
          </p>
        ) : null}
        {geoError ? (
          <p className="mt-2 text-[12px] text-red-700">{geoError}</p>
        ) : null}
      </div>

      {quote ? (
        <div className="mt-5 grid grid-cols-3 gap-3 border border-black/10 bg-black/[0.02] px-4 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
              Distance
            </p>
            <p className="mt-1 text-[15px] font-medium">
              {quote.distanceKm > 0
                ? formatDistanceKm(quote.distanceKm)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
              ETA
            </p>
            <p className="mt-1 text-[15px] font-medium">
              ~{quote.etaMinutes} min
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
              Delivery
            </p>
            <p className="mt-1 text-[15px] font-medium">
              {formatPrice(quote.deliveryMinor / 100)}
            </p>
          </div>
          <p className="col-span-3 text-[12px] text-black/40">
            {quote.breakdown}
            {quote.source === "road"
              ? " · road"
              : quote.source === "zone_fallback"
                ? " · estimate"
                : ""}
          </p>
          {quote.adjustments?.length ? (
            <ul className="col-span-3 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-black/50">
              {quote.adjustments.map((a) => (
                <li key={a.id}>
                  {a.label} +{formatPrice(a.amountMajor)}
                </li>
              ))}
            </ul>
          ) : null}
          {quote.shopCount > 1 ? (
            <p className="col-span-3 text-[12px] text-black/40">
              {quote.shopCount} shops · stop fees included (one fee per shop,
              not per product)
            </p>
          ) : null}
        </div>
      ) : value.lat != null && value.lng != null ? (
        <p className="mt-5 text-[13px] text-black/40">Calculating delivery…</p>
      ) : null}

      {shopLegs.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {shopLegs.map((r) => (
            <li
              key={r.vendorId}
              className="flex items-baseline justify-between gap-3 text-[13px] text-black/50"
            >
              <span>
                <span className="font-medium text-black/70">{r.name}</span>
                {r.isBest ? (
                  <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-emerald-800/70">
                    Fastest to you
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatDistanceKm(r.distanceKm)} · ~{r.etaMinutes} min
              </span>
            </li>
          ))}
        </ul>
      ) : vendors.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {vendors.map((v) => (
            <li key={v.vendorId} className="text-[13px] text-black/50">
              <span className="font-medium text-black/70">{v.name}</span>
              {v.neighbourhood ? ` · ${v.neighbourhood}` : ""}
              {v.todayLabel ? ` · ${v.todayLabel}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-[13px] text-black/50 underline underline-offset-[5px] decoration-black/15 hover:text-black"
        >
          {editing ? "Hide editor" : "Edit address"}
        </button>
        <button
          type="button"
          onClick={refreshFromGps}
          disabled={resolving || status === "locating"}
          className="inline-flex items-center gap-1.5 text-[13px] text-black/50 underline underline-offset-[5px] decoration-black/15 hover:text-black disabled:opacity-40"
        >
          <Navigation className="h-3.5 w-3.5" strokeWidth={1.75} />
          {resolving || status === "locating"
            ? "Updating…"
            : "Use current location"}
        </button>
        {hasToken && markers.length > 0 ? (
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="text-[13px] text-black/50 underline underline-offset-[5px] decoration-black/15 hover:text-black"
          >
            Open full map
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-6 space-y-5 border-t border-black/[0.06] pt-6">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
              Building / place
            </span>
            <input
              value={value.building}
              onChange={(e) =>
                onChange({ ...value, building: e.target.value })
              }
              className={fieldClass}
              placeholder="Apartment, estate, landmark"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
              Street
            </span>
            <input
              value={value.street}
              onChange={(e) => onChange({ ...value, street: e.target.value })}
              className={fieldClass}
              placeholder="Street name"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
              Area
            </span>
            <input
              value={
                value.deliveryArea === "other"
                  ? value.areaOther
                  : value.deliveryArea
              }
              onChange={(e) =>
                onChange({
                  ...value,
                  deliveryArea: e.target.value.trim() || "Your location",
                  areaOther: "",
                  label: value.label || e.target.value,
                })
              }
              className={fieldClass}
              placeholder="Neighbourhood"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
              Nearby landmark
            </span>
            <input
              value={value.landmark}
              onChange={(e) =>
                onChange({ ...value, landmark: e.target.value })
              }
              className={fieldClass}
              placeholder="Optional"
            />
          </label>
          <button
            type="button"
            onClick={() => void updateFromAddress()}
            disabled={geocoding}
            className="inline-flex min-h-11 items-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white hover:opacity-80 disabled:opacity-40"
          >
            {geocoding ? "Updating pin…" : "Update pin & recalculate"}
          </button>
          <p className="text-[12px] text-black/40">
            Moves the map pin from this address and refreshes delivery distance,
            ETA, and fee for this order only.
          </p>
        </div>
      ) : null}

      {dayWindow ? (
        <div className="mt-10 border-t border-black/[0.06] pt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
            When
          </p>
          <p className="mt-2 text-[14px] text-black/45">
            Same day · {dayWindow.openTime}–{dayWindow.closeTime}
          </p>
          <div className="mt-5">
            <SameDayTiming
              window={dayWindow}
              mode={timingMode}
              time={pickupTime}
              etaMinutes={quote?.etaMinutes || 45}
              onModeChange={onTimingModeChange}
              onChange={onTimingChange}
              fulfilment="delivery"
            />
          </div>
          {timingMode === "schedule" && !pickupDate ? (
            <p className="mt-3 text-[12px] text-black/40">Pick a time slot.</p>
          ) : null}
        </div>
      ) : null}

      <CheckoutDeliveryMap
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        pin={
          value.lat != null && value.lng != null
            ? { lat: value.lat, lng: value.lng }
            : null
        }
        pinLabel={summary}
        vendors={vendors}
        quote={quote}
        tripRoutes={tripRoutes}
        onPinChange={(lat, lng, label) => {
          void setManualPlace(lat, lng, label, "map_pin");
        }}
        onDeliverHere={(lat, lng, label) => {
          void setManualPlace(lat, lng, label, "deliver_here");
        }}
        onUseGps={refreshFromGps}
        gpsBusy={resolving || status === "locating"}
      />
    </div>
  );
}
