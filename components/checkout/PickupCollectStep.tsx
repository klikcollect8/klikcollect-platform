"use client";

import dynamic from "next/dynamic";
import { MapPin, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckoutVendor, CollectMode } from "@/lib/checkout/types";
import {
  getMapboxToken,
  MAPBOX_FLAT_STYLE,
  NAIROBI_CENTER,
} from "@/lib/mapbox";
import type { MapMarker } from "@/components/map/MapCanvas";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] items-center justify-center bg-black/[0.03] text-[11px] uppercase tracking-[0.2em] text-black/35">
      Loading map
    </div>
  ),
});

type Props = {
  vendors: CheckoutVendor[];
  loading?: boolean;
  collectMode: CollectMode;
  onCollectModeChange: (mode: CollectMode) => void;
  hubVendorId: string | null;
  onHubVendorChange: (vendorId: string) => void;
  /** Kept for CheckoutWizard API compatibility; unused in simple pickup UI. */
  hybridQuote?: unknown;
  classicQuote?: unknown;
};

export default function PickupCollectStep({
  vendors,
  loading,
  collectMode,
  onCollectModeChange,
  hubVendorId,
  onHubVendorChange,
}: Props) {
  const multi = vendors.length > 1;
  const hasToken = !!getMapboxToken();
  const markers: MapMarker[] = vendors
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({
      id: v.vendorId,
      lat: v.lat as number,
      lng: v.lng as number,
      label: v.name,
      kind: "pickup" as const,
      active: !hubVendorId || v.vendorId === hubVendorId,
    }));

  if (loading) {
    return (
      <div>
        <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
          Collect point
        </h2>
        <p className="mt-3 text-[14px] text-black/45">Loading shop details…</p>
      </div>
    );
  }

  if (!vendors.length) {
    return (
      <div>
        <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
          Collect point
        </h2>
        <p className="mt-3 text-[14px] text-black/45">
          We couldn&apos;t find shop details for items in your cart.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
        {multi ? "Your shops" : "Your shop"}
      </h2>
      <p className="mt-3 text-[14px] text-black/45">
        {multi
          ? "Pick up from each shop, or consolidate to one. You’ll get a receipt after pay."
          : "Collect here during today’s hours — you’ll get a receipt after pay."}
      </p>

      {hasToken && markers.length > 0 ? (
        <div className="mt-8 overflow-hidden border border-black/10">
          <div className="h-[220px] sm:h-[280px]">
            <MapCanvas
              className="h-full w-full"
              mapStyle={MAPBOX_FLAT_STYLE}
              center={
                markers.length === 1
                  ? [markers[0]!.lng, markers[0]!.lat]
                  : NAIROBI_CENTER
              }
              zoom={markers.length === 1 ? 14 : 11}
              pitch={0}
              bearing={0}
              flat
              markers={markers}
              fitMarkers={markers.length > 1}
              interactive
              alwaysShowLabels
              showNavControls
              minimalControls
              onMarkerClick={(id) => onHubVendorChange(id)}
            />
          </div>
        </div>
      ) : null}

      <ul className="mt-8 divide-y divide-black/[0.06] border-y border-black/[0.06]">
        {vendors.map((v) => (
          <li key={v.vendorId} className="flex gap-3 py-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-black/[0.04]">
              <Store className="h-4 w-4 text-black/50" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{v.name}</p>
              <p className="mt-1 flex items-start gap-1.5 text-[13px] text-black/45">
                <MapPin
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.5}
                />
                <span>
                  {[v.address, v.neighbourhood, v.city]
                    .filter(Boolean)
                    .join(", ") || "Address on request"}
                </span>
              </p>
              <p className="mt-1 text-[12px] text-black/35">
                {v.openNow ? "Open now" : "Closed"} · {v.todayLabel}
                {v.phone ? ` · ${v.phone}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {multi ? (
        <div className="mt-8 space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
            How do you want to collect?
          </p>
          <button
            type="button"
            onClick={() => onCollectModeChange("classic")}
            className={cn(
              "w-full px-4 py-5 text-left transition-colors",
              collectMode === "classic"
                ? "bg-black text-white"
                : "bg-black/[0.03] hover:bg-black/[0.06]",
            )}
          >
            <span className="block text-[15px] font-medium">
              Visit each shop
            </span>
            <span
              className={cn(
                "mt-1.5 block text-[13px] leading-snug",
                collectMode === "classic" ? "text-white/65" : "text-black/45",
              )}
            >
              Classic click &amp; collect at every vendor
            </span>
          </button>
          <button
            type="button"
            onClick={() => onCollectModeChange("hybrid")}
            className={cn(
              "w-full px-4 py-5 text-left transition-colors",
              collectMode === "hybrid"
                ? "bg-black text-white"
                : "bg-black/[0.03] hover:bg-black/[0.06]",
            )}
          >
            <span className="block text-[15px] font-medium">
              One shop pickup
            </span>
            <span
              className={cn(
                "mt-1.5 block text-[13px] leading-snug",
                collectMode === "hybrid" ? "text-white/65" : "text-black/45",
              )}
            >
              Consolidate to a shop you choose
            </span>
          </button>
        </div>
      ) : null}

      {multi && collectMode === "hybrid" ? (
        <div className="mt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
            Collect at
          </p>
          <div className="mt-3 space-y-2">
            {vendors.map((v) => (
              <button
                key={v.vendorId}
                type="button"
                onClick={() => onHubVendorChange(v.vendorId)}
                className={cn(
                  "flex w-full items-start gap-3 border px-4 py-4 text-left transition-colors",
                  hubVendorId === v.vendorId
                    ? "border-black bg-black/[0.03]"
                    : "border-black/10 hover:border-black/25",
                )}
              >
                <span
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0 rounded-full border",
                    hubVendorId === v.vendorId
                      ? "border-black bg-black"
                      : "border-black/25",
                  )}
                />
                <span>
                  <span className="block text-[14px] font-medium">{v.name}</span>
                  <span className="mt-0.5 block text-[12px] text-black/40">
                    {[v.neighbourhood, v.address].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!multi ? (
        <p className="mt-6 text-[13px] text-black/45">
          No delivery fee — show your receipt when you collect.
        </p>
      ) : null}
    </div>
  );
}
