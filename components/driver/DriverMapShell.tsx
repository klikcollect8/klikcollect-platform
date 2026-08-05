"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type mapboxgl from "mapbox-gl";
import type { MapMarker } from "@/components/map/MapCanvas";
import MapChrome, { mapGlass } from "@/components/map/MapChrome";
import MapEtaHud from "@/components/map/MapEtaHud";
import OnlineToggle from "@/components/driver/OnlineToggle";
import {
  MAP_FLAT_ZOOM,
  NAIROBI_CENTER,
  povPreset,
  stylePreset,
  type MapPovId,
  type MapStyleId,
} from "@/lib/mapbox";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--kc-canvas)]">
      <p className="animate-pulse text-[11px] font-medium uppercase tracking-[0.22em] text-black/30">
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
  routeMeta?: { distanceM: number; durationS: number } | null;
  cameraKey?: number;
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
  routeMeta = null,
  cameraKey = 0,
  onRecenter,
  children,
}: DriverMapShellProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [styleId, setStyleId] = useState<MapStyleId>("street");
  const [povId, setPovId] = useState<MapPovId>("street");
  const [povCameraKey, setPovCameraKey] = useState(0);

  const preset = stylePreset(styleId);
  const pov = povPreset(povId);
  const mapFlat = Boolean(pov.flat);
  const mapFree = Boolean(pov.interactive);
  const center = userLngLat || NAIROBI_CENTER;

  const applyPov = useCallback((id: MapPovId) => {
    setPovId(id);
    setPovCameraKey((n) => n + 1);
    const p = povPreset(id);
    const map = mapRef.current;
    if (!map) return;
    const nextFlat = Boolean(p.flat);
    const nextFree = Boolean(p.interactive);
    try {
      map.setMaxPitch(nextFree || !nextFlat ? 85 : 0);
      if (nextFree || !nextFlat) {
        map.dragRotate.enable();
        map.touchPitch.enable();
      } else {
        map.dragRotate.disable();
        map.touchPitch.disable();
      }
      map.easeTo({
        pitch: nextFlat && !nextFree ? 0 : p.pitch,
        bearing: nextFlat && !nextFree ? 0 : p.bearing,
        duration: 700,
        essential: true,
      });
    } catch {
      /* ok */
    }
  }, []);

  return (
    <div
      ref={rootRef}
      className="relative h-[100dvh] w-full overflow-hidden bg-[var(--kc-canvas)]"
    >
      <div className="absolute inset-0">
        <MapCanvas
          className="h-full w-full"
          mapStyle={preset.url}
          flat={mapFlat}
          freeCamera={mapFree}
          center={center}
          zoom={MAP_FLAT_ZOOM}
          pitch={mapFlat && !mapFree ? 0 : pov.pitch}
          bearing={mapFlat && !mapFree ? 0 : pov.bearing}
          followUser={online && povId !== "free"}
          userLngLat={userLngLat}
          markers={markers}
          routeGeoJSON={routeGeoJSON || null}
          fitRoute={!!routeGeoJSON}
          interactive
          minimalControls
          showNavControls={false}
          cameraKey={`${cameraKey}-${povCameraKey}`}
          onReady={(map) => {
            mapRef.current = map;
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/15 via-transparent to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-[calc(0.85rem+env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex items-start justify-between gap-3">
          <OnlineToggle
            online={online}
            busy={onlineBusy}
            onChange={onOnlineChange}
          />
          <div className="flex flex-col items-end gap-2">
            <div
              className={cn(
                "flex items-center gap-2 py-2.5 pl-3 pr-3.5 text-[12px] font-medium text-black/70",
                mapGlass,
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5",
                  online ? "bg-emerald-500" : "bg-black/25",
                )}
              />
              <span className="tabular-nums text-black">{todayCount}</span>
              <span className="uppercase tracking-[0.12em] text-black/40">
                stops
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-3 z-40 sm:bottom-6 sm:right-5">
        <MapChrome
          styleId={styleId}
          onStyleChange={setStyleId}
          povId={povId}
          onPovChange={applyPov}
          compact
          collapsible
          onRecenter={onRecenter}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onFullscreen={() => {
            const el = rootRef.current;
            if (!el) return;
            if (document.fullscreenElement) void document.exitFullscreen();
            else void el.requestFullscreen?.();
          }}
        />
      </div>

      {routeMeta ? (
        <div className="pointer-events-none absolute bottom-4 left-3 z-30 sm:bottom-6 sm:left-5">
          <MapEtaHud
            distanceM={routeMeta.distanceM}
            durationS={routeMeta.durationS}
            label="ETA"
          />
        </div>
      ) : null}

      {children}
    </div>
  );
}
