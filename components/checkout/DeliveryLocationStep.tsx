"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, MapPin } from "lucide-react";
import { useUserLocation } from "@/components/providers/LocationProvider";
import { reverseGeocode } from "@/lib/mapbox-search";
import { loadAddresses } from "@/lib/account-storage";
import {
  formatDistanceKm,
  getMapboxToken,
} from "@/lib/mapbox";
import { formatPrice } from "@/lib/currency";
import {
  DELIVERY_AREAS,
  matchDeliveryArea,
  resolveAreaLabel,
} from "@/components/checkout/fulfilment";
import ThemeSelect from "@/components/ui/ThemeSelect";
import SameDayTiming, {
  type TimingMode,
} from "@/components/checkout/SameDayTiming";
import type { CheckoutVendor } from "@/lib/checkout/types";
import type { DeliveryQuote } from "@/lib/checkout/delivery-pricing";
import type { DayWindow } from "@/lib/checkout/same-day-slots";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] items-center justify-center bg-black/[0.03] text-[11px] uppercase tracking-[0.2em] text-black/35">
      Loading map
    </div>
  ),
});

const fieldClass =
  "w-full border-b border-black/15 bg-transparent py-3 text-[16px] outline-none focus:border-black/40 placeholder:text-black/25";

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
  dayWindow: DayWindow;
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
  const { coords, status, track, error } = useUserLocation();
  const [resolving, setResolving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const hasToken = !!getMapboxToken();

  useEffect(() => {
    track();
  }, [track]);

  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;

    async function hydrate() {
      if (coords) {
        setResolving(true);
        const fallback = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
        try {
          const label = await reverseGeocode(coords.lng, coords.lat);
          if (cancelled) return;
          const matched = matchDeliveryArea(label || fallback);
          onChange({
            deliveryArea: matched.area,
            areaOther: matched.areaOther,
            street: label || fallback,
            building: "",
            landmark: "",
            lat: coords.lat,
            lng: coords.lng,
            label: label || fallback,
            gateCode: "",
            deliveryNote: "",
          });
        } catch {
          if (cancelled) return;
          const matched = matchDeliveryArea(fallback);
          onChange({
            deliveryArea: matched.area,
            areaOther: matched.areaOther,
            street: fallback,
            building: "",
            landmark: "",
            lat: coords.lat,
            lng: coords.lng,
            label: fallback,
            gateCode: "",
            deliveryNote: "",
          });
        } finally {
          if (!cancelled) {
            setResolving(false);
            setHydrated(true);
          }
        }
        return;
      }

      if (status === "locating" || status === "idle") return;

      const saved = loadAddresses();
      const def = saved.find((a) => a.isDefault) ?? saved[0];
      if (def) {
        const cityText = [def.street, def.city, def.state]
          .filter(Boolean)
          .join(", ");
        const matched = matchDeliveryArea(cityText);
        onChange({
          deliveryArea: matched.area,
          areaOther: matched.areaOther || def.city,
          street: def.street || "",
          building: def.name && def.name !== "Home" ? def.name : "",
          landmark: "",
          lat: null,
          lng: null,
          label: cityText || def.street,
          gateCode: "",
          deliveryNote: "",
        });
        setHydrated(true);
        setEditing(true);
        return;
      }

      if (
        status === "denied" ||
        status === "error" ||
        status === "unsupported"
      ) {
        setEditing(true);
        setHydrated(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lng, status, hydrated]);

  const refreshFromGps = async () => {
    track();
    if (!coords) return;
    setResolving(true);
    try {
      const label = await reverseGeocode(coords.lng, coords.lat);
      const matched = matchDeliveryArea(label || "");
      onChange({
        ...value,
        deliveryArea: matched.area,
        areaOther: matched.areaOther,
        street: label || value.street,
        lat: coords.lat,
        lng: coords.lng,
        label: label || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      });
      setEditing(false);
      setHydrated(true);
    } finally {
      setResolving(false);
    }
  };

  const areaLabel = resolveAreaLabel(value.deliveryArea, value.areaOther);
  const summary =
    value.label ||
    [value.building, value.street, value.landmark].filter(Boolean).join(", ") ||
    "Locating…";

  const pin = useMemo(() => {
    if (value.lng == null || value.lat == null) return null;
    return {
      id: "delivery",
      lng: value.lng,
      lat: value.lat,
      kind: "user" as const,
      label: "Deliver here",
      active: true,
    };
  }, [value.lat, value.lng]);

  const shopMarkers = vendors
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({
      id: v.vendorId,
      lat: v.lat as number,
      lng: v.lng as number,
      kind: "vendor" as const,
      label: v.name,
    }));

  const markers = pin ? [pin, ...shopMarkers] : shopMarkers;

  return (
    <div>
      <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
        Confirm delivery
      </h2>
      <p className="mt-3 text-[14px] text-black/45">
        From your live location — confirm, then pick today&apos;s delivery window.
      </p>

      {markers.length > 0 && hasToken ? (
        <div className="mt-8 overflow-hidden border border-black/8">
          <div className="h-[200px] sm:h-[240px]">
            <MapCanvas
              flat
              interactive={false}
              center={pin ? [pin.lng, pin.lat] : undefined}
              zoom={14}
              markers={markers}
              fitMarkers={markers.length > 1}
              className="h-full w-full"
            />
          </div>
        </div>
      ) : (
        <div className="mt-8 flex h-[140px] items-center justify-center border border-black/8 bg-black/[0.03]">
          <div className="text-center">
            <MapPin className="mx-auto h-5 w-5 text-black/35" strokeWidth={1.5} />
            <p className="mt-2 text-[12px] text-black/40">
              {resolving || status === "locating"
                ? "Finding your location…"
                : status === "denied"
                  ? "Location permission off — edit below"
                  : "Map preview unavailable"}
            </p>
          </div>
        </div>
      )}

      {/* Detailed address */}
      <div className="mt-6 border-y border-black/[0.06] py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
          Deliver to
        </p>
        {value.building ? (
          <p className="mt-2 text-[13px] text-black/45">{value.building}</p>
        ) : null}
        <p className="mt-1 text-[16px] font-medium leading-snug">{summary}</p>
        <p className="mt-1 text-[13px] text-black/40">{areaLabel}</p>
        {value.landmark ? (
          <p className="mt-1 text-[13px] text-black/40">Near {value.landmark}</p>
        ) : null}
        {error && status === "denied" ? (
          <p className="mt-2 text-[12px] text-red-700">
            Location access denied. Edit the address for this delivery.
          </p>
        ) : null}
      </div>

      {/* Distance / ETA / price */}
      {quote ? (
        <div className="mt-5 grid grid-cols-3 gap-3 border border-black/8 bg-black/[0.02] px-4 py-4">
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
            <p className="mt-1 text-[15px] font-medium">~{quote.etaMinutes} min</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
              Delivery
            </p>
            <p className="mt-1 text-[15px] font-medium">
              {formatPrice(quote.deliveryMinor / 100)}
            </p>
          </div>
          <p className="col-span-3 text-[12px] text-black/40">{quote.breakdown}</p>
        </div>
      ) : null}

      {vendors.length > 0 ? (
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
          {editing ? "Hide editor" : "Edit for this delivery"}
        </button>
        <button
          type="button"
          onClick={() => void refreshFromGps()}
          disabled={resolving || !coords}
          className="text-[13px] text-black/50 underline underline-offset-[5px] decoration-black/15 hover:text-black disabled:opacity-35"
        >
          {resolving ? "Updating…" : "Use current location"}
        </button>
      </div>

      {editing ? (
        <div className="mt-8 space-y-5">
          <label className="block space-y-2">
            <span className="text-[12px] text-black/40">Area</span>
            <ThemeSelect
              value={value.deliveryArea}
              onValueChange={(area) =>
                onChange({
                  ...value,
                  deliveryArea: area,
                  areaOther: area === "other" ? value.areaOther : "",
                })
              }
              options={[...DELIVERY_AREAS]}
              fullWidth
            />
          </label>
          {value.deliveryArea === "other" ? (
            <label className="block space-y-2">
              <span className="text-[12px] text-black/40">Neighbourhood</span>
              <input
                value={value.areaOther}
                onChange={(e) =>
                  onChange({ ...value, areaOther: e.target.value })
                }
                placeholder="e.g. Kileleshwa"
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="block space-y-2">
            <span className="text-[12px] text-black/40">Building / estate</span>
            <input
              value={value.building}
              onChange={(e) => onChange({ ...value, building: e.target.value })}
              placeholder="Optional"
              className={fieldClass}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[12px] text-black/40">Street / address</span>
            <input
              value={value.street}
              onChange={(e) =>
                onChange({
                  ...value,
                  street: e.target.value,
                  label: e.target.value,
                })
              }
              placeholder="Street address"
              className={fieldClass}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[12px] text-black/40">Landmark</span>
            <input
              value={value.landmark}
              onChange={(e) => onChange({ ...value, landmark: e.target.value })}
              placeholder="Optional"
              className={fieldClass}
            />
          </label>
        </div>
      ) : null}

      {/* Collapsible instructions — not a separate screen */}
      <div className="mt-8 border-t border-black/[0.06] pt-5">
        <button
          type="button"
          onClick={() => setInstructionsOpen((o) => !o)}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="block text-[14px] font-medium">
              Delivery instructions
            </span>
            <span className="mt-0.5 block text-[12px] text-black/40">
              Optional — gate codes, floor, call on arrival
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-black/40 transition-transform",
              instructionsOpen && "rotate-180",
            )}
            strokeWidth={1.5}
          />
        </button>
        {instructionsOpen ? (
          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-[12px] text-black/40">Gate / access code</span>
              <input
                value={value.gateCode}
                onChange={(e) =>
                  onChange({ ...value, gateCode: e.target.value })
                }
                placeholder="e.g. #4521"
                className={fieldClass}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[12px] text-black/40">Notes for the rider</span>
              <textarea
                value={value.deliveryNote}
                onChange={(e) =>
                  onChange({ ...value, deliveryNote: e.target.value })
                }
                rows={3}
                placeholder="Call when outside, leave with security…"
                className={cn(fieldClass, "resize-none")}
              />
            </label>
          </div>
        ) : value.gateCode || value.deliveryNote ? (
          <p className="mt-2 text-[12px] text-black/40">
            {[value.gateCode && `Gate ${value.gateCode}`, value.deliveryNote]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      <SameDayTiming
        window={dayWindow}
        mode={timingMode}
        time={pickupTime}
        etaMinutes={quote?.etaMinutes ?? 35}
        onModeChange={onTimingModeChange}
        onChange={onTimingChange}
        fulfilment="delivery"
      />
      {/* keep date in sync visually */}
      <p className="sr-only">{pickupDate}</p>
    </div>
  );
}
