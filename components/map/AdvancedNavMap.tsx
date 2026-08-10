"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  Crosshair,
  LocateFixed,
  Map as MapIcon,
  Navigation,
  VolumeX,
} from "lucide-react";
import { useUserLocation } from "@/components/providers/LocationProvider";
import type { MapMarker } from "@/components/map/MapCanvas";
import MapEtaHud from "@/components/map/MapEtaHud";
import { mapGlass } from "@/components/map/MapChrome";
import {
  getMapboxToken,
  MAPBOX_FLAT_STYLE,
  MAPBOX_SATELLITE_STYLE,
  MAPBOX_STYLE_FALLBACK,
  NAIROBI_CENTER,
  buildStaticMapUrl,
} from "@/lib/mapbox";
import { fetchDirectionsAll } from "@/lib/mapbox-api";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#e8ebe6]">
      <p className="animate-pulse text-[11px] font-medium uppercase tracking-[0.2em] text-black/30">
        Loading map
      </p>
    </div>
  ),
});

const MapSearchBox = dynamic(() => import("@/components/map/MapSearchBox"), {
  ssr: false,
  loading: () => <div className="h-11 border border-black/10 bg-white/50" />,
});

export type NavStyleId =
  | "streets"
  | "standard"
  | "dark"
  | "satellite"
  | "outdoors";

const NAV_STYLES: {
  id: NavStyleId;
  name: string;
  url: string;
  pitch: number;
  flat?: boolean;
}[] = [
  {
    id: "streets",
    name: "Streets",
    url: MAPBOX_FLAT_STYLE,
    pitch: 0,
    flat: true,
  },
  {
    id: "standard",
    name: "Standard",
    url: MAPBOX_STYLE_FALLBACK,
    pitch: 45,
  },
  {
    id: "dark",
    name: "Dark",
    url: "mapbox://styles/mapbox/dark-v11",
    pitch: 0,
    flat: true,
  },
  {
    id: "satellite",
    name: "Satellite",
    url: MAPBOX_SATELLITE_STYLE,
    pitch: 60,
  },
  {
    id: "outdoors",
    name: "Outdoors",
    url: "mapbox://styles/mapbox/outdoors-v12",
    pitch: 0,
    flat: true,
  },
];

export type AdvancedNavMapProps = {
  className?: string;
  /** fullscreen = tall nav chrome; compact = cart/checkout strip */
  variant?: "fullscreen" | "compact";
  markers?: MapMarker[];
  vendorGeoJSON?: GeoJSON.FeatureCollection | null;
  /** Destination for live directions (user → here) */
  destination?: { lng: number; lat: number; label?: string } | null;
  /** Override origin; defaults to live GPS */
  origin?: { lng: number; lat: number } | null;
  /** Prefetched route (skips directions fetch when set) */
  routeGeoJSON?: GeoJSON.LineString | null;
  altRoutesGeoJSON?: GeoJSON.FeatureCollection | null;
  showSearch?: boolean;
  showStyleSwitcher?: boolean;
  showStreetPreview?: boolean;
  showTraffic?: boolean;
  followUserDefault?: boolean;
  interactive?: boolean;
  fitMarkers?: boolean | number;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onReady?: (map: MapboxMap) => void;
  onDestinationPick?: (lng: number, lat: number, label?: string) => void;
};

/**
 * Shared Mapbox nav surface: style chips, live follow, driving-traffic
 * directions, ETA HUD, and pitched street-level preview (not Street View).
 */
export default function AdvancedNavMap({
  className,
  variant = "fullscreen",
  markers = [],
  vendorGeoJSON = null,
  destination = null,
  origin = null,
  routeGeoJSON: routeOverride = null,
  altRoutesGeoJSON: altOverride = null,
  showSearch = true,
  showStyleSwitcher = true,
  showStreetPreview = true,
  showTraffic = true,
  followUserDefault = false,
  interactive = true,
  fitMarkers,
  onMapClick,
  onReady,
  onDestinationPick,
}: AdvancedNavMapProps) {
  const token = getMapboxToken();
  const { coords, track } = useUserLocation();
  const [styleId, setStyleId] = useState<NavStyleId>("streets");
  const [followUser, setFollowUser] = useState(followUserDefault);
  const [streetMode, setStreetMode] = useState(false);
  const [mutedChrome, setMutedChrome] = useState(false);
  const [routeGeoJSON, setRouteGeoJSON] = useState<GeoJSON.LineString | null>(
    null,
  );
  const [altRoutesGeoJSON, setAltRoutesGeoJSON] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [eta, setEta] = useState<{ distanceM: number; durationS: number } | null>(
    null,
  );
  const mapRef = useRef<MapboxMap | null>(null);

  const style = NAV_STYLES.find((s) => s.id === styleId) || NAV_STYLES[0];
  const userLngLat = useMemo((): [number, number] | null => {
    if (origin) return [origin.lng, origin.lat];
    if (coords) return [coords.lng, coords.lat];
    return null;
  }, [origin, coords]);

  const pitch = streetMode ? 68 : style.pitch;
  const zoom = streetMode ? 17.6 : variant === "compact" ? 13.5 : 15.2;
  const bearing = streetMode ? -12 : 0;
  const center = useMemo((): [number, number] => {
    if (destination) return [destination.lng, destination.lat];
    if (userLngLat) return userLngLat;
    return NAIROBI_CENTER;
  }, [destination, userLngLat]);

  const allMarkers = useMemo(() => {
    const list = [...markers];
    if (destination) {
      list.push({
        id: "nav-destination",
        lng: destination.lng,
        lat: destination.lat,
        label: destination.label || "Destination",
        kind: "dropoff",
        active: true,
      });
    }
    if (userLngLat) {
      list.push({
        id: "nav-user",
        lng: userLngLat[0],
        lat: userLngLat[1],
        label: "You",
        kind: "user",
        pulse: true,
      });
    }
    return list;
  }, [markers, destination, userLngLat]);

  useEffect(() => {
    if (routeOverride) {
      setRouteGeoJSON(routeOverride);
      setAltRoutesGeoJSON(altOverride);
      return;
    }
    if (!destination || !userLngLat || !token) {
      setRouteGeoJSON(null);
      setAltRoutesGeoJSON(null);
      setEta(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const routes = await fetchDirectionsAll(
        { lng: userLngLat[0], lat: userLngLat[1] },
        { lng: destination.lng, lat: destination.lat },
        "driving-traffic",
        { alternatives: true },
      );
      if (cancelled) return;
      const primary = routes[0];
      if (!primary) {
        setRouteGeoJSON(null);
        setAltRoutesGeoJSON(null);
        setEta(null);
        return;
      }
      setRouteGeoJSON(primary.geometry);
      setEta({ distanceM: primary.distanceM, durationS: primary.durationS });
      if (routes.length > 1) {
        setAltRoutesGeoJSON({
          type: "FeatureCollection",
          features: routes.slice(1).map((r, i) => ({
            type: "Feature",
            properties: { id: `alt-${i}` },
            geometry: r.geometry,
          })),
        });
      } else {
        setAltRoutesGeoJSON(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destination, userLngLat, token, routeOverride, altOverride]);

  const handleReady = useCallback(
    (map: MapboxMap) => {
      mapRef.current = map;
      onReady?.(map);
    },
    [onReady],
  );

  const recenter = useCallback(() => {
    track();
    setFollowUser(true);
    if (mapRef.current && userLngLat) {
      mapRef.current.easeTo({
        center: userLngLat,
        zoom: streetMode ? 17.6 : 16,
        pitch,
        bearing,
        duration: 700,
      });
    }
  }, [track, userLngLat, streetMode, pitch, bearing]);

  const previewCenter = destination
    ? ([destination.lng, destination.lat] as [number, number])
    : center;
  const staticPreview =
    token && showStreetPreview
      ? buildStaticMapUrl({
          lng: previewCenter[0],
          lat: previewCenter[1],
          zoom: 17,
          width: 280,
          height: 160,
        })
      : null;

  if (!token) {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-black/10 bg-black/[0.03] text-[13px] text-black/40",
          variant === "fullscreen" ? "min-h-[70vh]" : "min-h-[180px]",
          className,
        )}
      >
        Mapbox token not configured
      </div>
    );
  }

  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-black/10 bg-[#e8ebe6]",
        compact ? "min-h-[200px]" : "min-h-[70vh]",
        className,
      )}
    >
      <MapCanvas
        mapStyle={style.url}
        flat={streetMode ? false : Boolean(style.flat)}
        freeCamera={!streetMode}
        pitch={pitch}
        bearing={bearing}
        zoom={zoom}
        center={center}
        interactive={interactive}
        showNavControls={!mutedChrome && !compact}
        minimalControls={compact || mutedChrome}
        followUser={followUser}
        userLngLat={userLngLat}
        markers={allMarkers}
        vendorGeoJSON={vendorGeoJSON}
        routeGeoJSON={routeGeoJSON}
        altRoutesGeoJSON={altRoutesGeoJSON}
        showTraffic={showTraffic && !streetMode}
        fitMarkers={
          fitMarkers ??
          (routeGeoJSON ? false : allMarkers.length > 1 ? true : false)
        }
        fitRoute={Boolean(routeGeoJSON)}
        onMapClick={onMapClick}
        onReady={handleReady}
        className="h-full w-full"
        style={{ minHeight: compact ? 200 : "70vh" }}
      />

      {!mutedChrome ? (
        <>
          {showSearch && !compact ? (
            <div className="pointer-events-auto absolute left-3 right-3 top-3 z-10 sm:left-4 sm:right-auto sm:w-[min(100%,360px)]">
              <MapSearchBox
                onSelect={(place) => {
                  onDestinationPick?.(
                    place.lng,
                    place.lat,
                    place.name || place.fullAddress,
                  );
                }}
              />
            </div>
          ) : null}

          {showStyleSwitcher ? (
            <div
              className={cn(
                "pointer-events-auto absolute z-10 flex flex-wrap gap-1 p-1",
                mapGlass,
                compact
                  ? "bottom-3 left-3 right-3 justify-center"
                  : "bottom-3 left-3 max-w-[calc(100%-6rem)]",
              )}
            >
              {NAV_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStyleId(s.id);
                    if (s.id === "satellite") setStreetMode(false);
                  }}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
                    styleId === s.id
                      ? "bg-black text-white"
                      : "text-black/50 hover:text-black",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : null}

          <div
            className={cn(
              "pointer-events-auto absolute z-10 flex flex-col gap-2",
              compact ? "right-3 top-3" : "right-3 top-3 sm:top-[4.5rem]",
            )}
          >
            <button
              type="button"
              onClick={recenter}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center",
                mapGlass,
                followUser ? "text-black" : "text-black/45",
              )}
              aria-label="Recenter on me"
              title="Live tracking"
            >
              <LocateFixed className="h-4 w-4" strokeWidth={1.75} />
            </button>
            {showStreetPreview ? (
              <button
                type="button"
                onClick={() => setStreetMode((v) => !v)}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center",
                  mapGlass,
                  streetMode ? "text-black" : "text-black/45",
                )}
                aria-label="Street-level preview"
                title="Street-level camera (pitched, not Street View)"
              >
                <Crosshair className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
            {!compact ? (
              <button
                type="button"
                onClick={() => setMutedChrome((v) => !v)}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center",
                  mapGlass,
                  "text-black/45",
                )}
                aria-label="Mute chrome"
                title="Quieter map chrome"
              >
                <VolumeX className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>

          {eta ? (
            <div
              className={cn(
                "pointer-events-none absolute z-10",
                compact ? "left-3 top-3" : "left-3 bottom-16 sm:bottom-3",
              )}
            >
              <MapEtaHud
                distanceM={eta.distanceM}
                durationS={eta.durationS}
                label="Drive"
              />
            </div>
          ) : null}

          {showStreetPreview && streetMode && staticPreview && !compact ? (
            <div
              className={cn(
                "pointer-events-none absolute bottom-16 right-3 z-10 hidden w-[200px] overflow-hidden sm:block",
                mapGlass,
              )}
            >
              <div className="relative aspect-[7/4] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staticPreview}
                  alt="Street-level close-up"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="px-2 py-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-black/40">
                Ground preview · pitched camera
              </p>
            </div>
          ) : null}

          {destination && !eta && !routeOverride ? (
            <div
              className={cn(
                "absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-black/45",
                mapGlass,
              )}
            >
              <Navigation className="mr-1.5 inline h-3.5 w-3.5" />
              Routing…
            </div>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          onClick={() => setMutedChrome(false)}
          className={cn(
            "absolute right-3 top-3 z-10 inline-flex h-10 items-center gap-2 px-3 text-[11px] uppercase tracking-[0.14em]",
            mapGlass,
          )}
        >
          <MapIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
          Show controls
        </button>
      )}
    </div>
  );
}
