"use client";

import dynamic from "next/dynamic";
import { LocateFixed } from "lucide-react";
import type { MapMarker } from "@/components/map/MapCanvas";
import { MAPBOX_FLAT_STYLE, NAIROBI_CENTER, MAP_FLAT_ZOOM } from "@/lib/mapbox";
import OnlineToggle from "@/components/driver/OnlineToggle";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#dfe3e0]">
      <div className="h-10 w-10 animate-pulse rounded-full bg-black/10" />
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
        Loading map
      </p>
    </div>
  ),
});

type DriverMapShellProps = {
  online: boolean;
  onOnlineChange: (v: boolean) => void;
  onlineBusy?: boolean;
  todayCount?: number;
  userLngLat: [number, number] | null;
  markers: MapMarker[];
  routeGeoJSON?: GeoJSON.LineString | null;
  onRecenter: () => void;
  children: React.ReactNode;
};

export default function DriverMapShell({
  online,
  onOnlineChange,
  onlineBusy,
  todayCount = 0,
  userLngLat,
  markers,
  routeGeoJSON,
  onRecenter,
  children,
}: DriverMapShellProps) {
  const center = userLngLat || NAIROBI_CENTER;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#dfe3e0]">
      <div className="absolute inset-0">
        <MapCanvas
          className="h-full w-full"
          mapStyle={MAPBOX_FLAT_STYLE}
          flat
          center={center}
          zoom={MAP_FLAT_ZOOM}
          followUser={online}
          userLngLat={userLngLat}
          markers={markers}
          routeGeoJSON={routeGeoJSON || null}
          fitRoute={!!routeGeoJSON}
          interactive
          minimalControls
          showNavControls={false}
        />
      </div>

      {/* Top readability veil */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-black/25 via-black/5 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-[calc(0.85rem+env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-center justify-between gap-3">
          <OnlineToggle
            online={online}
            busy={onlineBusy}
            onChange={onOnlineChange}
          />
          <div className="flex items-center gap-2 rounded-full bg-white/95 py-2 pl-3 pr-3.5 text-[12px] font-semibold text-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/8 backdrop-blur">
            <span
              className={`h-2 w-2 rounded-full ${
                online ? "bg-emerald-500" : "bg-black/20"
              }`}
            />
            <span className="tabular-nums">{todayCount}</span>
            <span className="font-medium text-black/45">stops</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onRecenter}
        className="absolute right-4 z-30 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 text-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.14)] ring-1 ring-black/8 backdrop-blur transition active:scale-95"
        style={{ bottom: "calc(46vh + 0.5rem)" }}
        aria-label="Recenter map"
      >
        <LocateFixed className="h-5 w-5" />
      </button>

      {children}
    </div>
  );
}
