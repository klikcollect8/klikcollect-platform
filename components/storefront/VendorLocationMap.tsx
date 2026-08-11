"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import {
  buildStaticMapUrl,
  getMapboxToken,
  MAPBOX_STYLE,
  MAP_FLAT_ZOOM,
  NAIROBI_CENTER,
} from "@/lib/mapbox";
import type { MapMarker } from "@/components/map/MapCanvas";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[220px] items-center justify-center bg-black/[0.03] text-[11px] uppercase tracking-[0.2em] text-black/35">
      Loading map
    </div>
  ),
});

export type VendorMapPin = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type VendorLocationMapProps = {
  pins: VendorMapPin[];
  /** Focus a single pin; omit / null to fit all */
  activeId?: string | null;
  /** When true with multiple pins, fit bounds instead of focusing active */
  showAll?: boolean;
  onPinClick?: (id: string) => void;
  className?: string;
  heightClassName?: string;
};

export default function VendorLocationMap({
  pins,
  activeId,
  showAll = false,
  onPinClick,
  className,
  heightClassName = "h-[240px] sm:h-[320px]",
}: VendorLocationMapProps) {
  const [useGl, setUseGl] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const hasToken = !!getMapboxToken();

  const fitAll = showAll || (!activeId && pins.length > 1);

  const focus = useMemo(() => {
    if (!pins.length) return null;
    if (fitAll) return null;
    if (activeId) return pins.find((p) => p.id === activeId) || pins[0];
    return pins.length === 1 ? pins[0] : null;
  }, [pins, activeId, fitAll]);

  const markers: MapMarker[] = useMemo(
    () =>
      pins.map((p) => ({
        id: p.id,
        lng: p.lng,
        lat: p.lat,
        label: p.name,
        kind: "pickup" as const,
        active: !activeId || p.id === activeId,
        pulse: Boolean(activeId && p.id === activeId),
      })),
    [pins, activeId],
  );

  const center: [number, number] = focus
    ? [focus.lng, focus.lat]
    : pins[0]
      ? [pins[0].lng, pins[0].lat]
      : NAIROBI_CENTER;

  const staticUrl = focus
    ? buildStaticMapUrl({
        lng: focus.lng,
        lat: focus.lat,
        zoom: 15,
        width: 960,
        height: 540,
        marker: true,
        highDpi: true,
      })
    : null;

  if (!pins.length) {
    return (
      <div
        className={`flex items-center justify-center bg-black/[0.03] text-[13px] text-black/35 ${heightClassName} ${className || ""}`}
      >
        No map coordinates yet
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div
        className={`flex items-center justify-center bg-black/[0.03] px-6 text-center text-[13px] text-black/45 ${heightClassName} ${className || ""}`}
      >
        Map unavailable - set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#ebebe8] ${className || ""}`}>
      <div className={`${heightClassName} w-full`}>
        {useGl ? (
          <MapCanvas
            key={`vendor-map-${fitAll ? "all" : activeId || "one"}-${pins.map((p) => p.id).join("-")}`}
            className="h-full w-full"
            mapStyle={MAPBOX_STYLE}
            center={center}
            zoom={fitAll ? 12 : MAP_FLAT_ZOOM}
            pitch={0}
            bearing={0}
            flat
            markers={markers}
            fitMarkers={fitAll}
            cameraKey={fitAll ? "all" : activeId || "one"}
            interactive
            alwaysShowLabels
            followUser={false}
            showNavControls
            minimalControls
            onMarkerClick={onPinClick}
          />
        ) : staticUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staticUrl}
            alt={focus ? `Map of ${focus.name}` : "Store locations"}
            width={960}
            height={540}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <MapPin className="h-5 w-5 text-black/30" strokeWidth={1.5} />
            <p className="text-[13px] text-black/45">
              Map preview unavailable.
            </p>
            <button
              type="button"
              onClick={() => {
                setUseGl(true);
                setImgFailed(false);
              }}
              className="text-[12px] uppercase tracking-[0.14em] underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
