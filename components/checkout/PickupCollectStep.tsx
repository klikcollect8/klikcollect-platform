"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  MapPin,
  Maximize2,
  Store,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Map as MapboxMap } from "mapbox-gl";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/currency";
import {
  formatDistanceKm,
  getMapboxToken,
  MAPBOX_3D_STYLE,
  NAIROBI_CENTER,
  povPreset,
  stylePreset,
  type MapPovId,
  type MapStyleId,
} from "@/lib/mapbox";
import { useUserLocation } from "@/components/providers/LocationProvider";
import MapChrome, { mapGlass } from "@/components/map/MapChrome";
import {
  buildPickupTripRoutes,
  shopLegsToAltGeoJSON,
  type PickupTripRoutes,
} from "@/lib/checkout/delivery-routes";
import type { CheckoutVendor, CollectMode } from "@/lib/checkout/types";
import type { DeliveryQuote } from "@/lib/checkout/delivery-pricing";
import type { MapMarker } from "@/components/map/MapCanvas";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[180px] items-center justify-center bg-black/[0.03] text-[11px] uppercase tracking-[0.2em] text-black/35">
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
  hybridQuote: DeliveryQuote;
  classicQuote: DeliveryQuote;
};

export default function PickupCollectStep({
  vendors,
  loading,
  collectMode,
  onCollectModeChange,
  hubVendorId,
  onHubVendorChange,
  hybridQuote,
  classicQuote,
}: Props) {
  const multi = vendors.length > 1;
  const hasToken = !!getMapboxToken();
  const { coords, status, track } = useUserLocation();
  const [tripRoutes, setTripRoutes] = useState<PickupTripRoutes | null>(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [styleId, setStyleId] = useState<MapStyleId>("map-3d");
  const [povId, setPovId] = useState<MapPovId>("bird");
  const [povCameraKey, setPovCameraKey] = useState(0);
  const mapRef = useRef<MapboxMap | null>(null);

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

  /** Round GPS so tiny drifts don't rebuild routes / crash the page */
  const userKey = useMemo(() => {
    if (!coords) return null;
    return `${coords.lng.toFixed(4)},${coords.lat.toFixed(4)}`;
  }, [coords?.lat, coords?.lng]);

  const userPoint = useMemo(() => {
    if (!coords || !userKey) return null;
    const [lng, lat] = userKey.split(",").map(Number);
    return { lng, lat };
  }, [coords, userKey]);

  useEffect(() => {
    if (status === "idle") track();
  }, [status, track]);

  useEffect(() => {
    if (!hasToken || !userPoint || !shopCoords.length) {
      setTripRoutes(null);
      return;
    }

    let cancelled = false;
    setRoutesLoading(true);
    void (async () => {
      try {
        const trip = await buildPickupTripRoutes(userPoint, shopCoords);
        if (!cancelled) setTripRoutes(trip);
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasToken, userKey, shopsKey, userPoint, shopCoords]);

  useEffect(() => {
    if (!mapOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapOpen]);

  const markers = useMemo(() => {
    const list: MapMarker[] = [];
    if (userPoint) {
      list.push({
        id: "you",
        lat: userPoint.lat,
        lng: userPoint.lng,
        kind: "user",
        label: "You",
        active: true,
        pulse: true,
      });
    }
    shopCoords.forEach((v, i) => {
      const leg = tripRoutes?.shopLegs.find((l) => l.vendorId === v.vendorId);
      list.push({
        id: v.vendorId,
        lat: v.lat,
        lng: v.lng,
        kind: "stop",
        label: v.name,
        stopIndex: i + 1,
        active:
          hubVendorId === v.vendorId ||
          Boolean(leg?.isBest) ||
          tripRoutes?.bestMeta?.vendorId === v.vendorId,
      });
    });
    return list;
  }, [shopCoords, hubVendorId, tripRoutes, userPoint]);

  const primaryRoute = tripRoutes?.bestRoute ?? null;
  const altRoutes = useMemo(() => {
    if (!tripRoutes?.shopLegs.length || tripRoutes.shopLegs.length <= 1)
      return null;
    return shopLegsToAltGeoJSON(
      tripRoutes.shopLegs,
      tripRoutes.bestMeta?.vendorId,
    );
  }, [tripRoutes]);

  const style = stylePreset(styleId);
  const pov = povPreset(povId);
  const frost = mapGlass;

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
          ? "Green = best route from you to a shop. Grey = other pickup paths. Collect at each shop, or consolidate."
          : "Green line shows the best route from your location to the shop."}
      </p>

      {markers.length > 0 && hasToken ? (
        <div className="mt-8 overflow-hidden border border-black/8">
          <div className="relative h-[200px] sm:h-[260px]">
            <MapCanvas
              mapStyle={MAPBOX_3D_STYLE}
              flat={false}
              freeCamera
              pitch={58}
              bearing={-14}
              interactive={false}
              showNavControls={false}
              minimalControls
              markers={markers}
              routeGeoJSON={primaryRoute}
              altRoutesGeoJSON={altRoutes}
              fitMarkers={!primaryRoute}
              fitRoute={Boolean(primaryRoute)}
              className="h-full w-full"
            />
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 bg-white/95 px-3 py-2 text-[12px] font-medium uppercase tracking-[0.12em] text-black shadow-sm ring-1 ring-black/10 hover:bg-white"
            >
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Enlarge
            </button>
          </div>
          <div className="border-t border-black/[0.06] bg-white/40 px-3 py-2 text-[12px] text-black/45">
            {routesLoading
              ? "Finding best pickup routes…"
              : tripRoutes?.bestMeta
                ? `Best to collect · ${formatDistanceKm(tripRoutes.bestMeta.distanceKm)} · ~${tripRoutes.bestMeta.etaMinutes} min`
                : userPoint
                  ? "Routes appear when shops are located"
                  : "Allow location to see routes from you"}
          </div>
        </div>
      ) : null}

      <ul className="mt-6 divide-y divide-black/[0.06] border-y border-black/[0.06]">
        {vendors.map((v) => {
          const leg = tripRoutes?.shopLegs.find(
            (l) => l.vendorId === v.vendorId,
          );
          return (
            <li key={v.vendorId} className="flex gap-3 py-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-black/[0.04]">
                <Store className="h-4 w-4 text-black/50" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">
                  {v.name}
                  {leg?.isBest ? (
                    <span className="ml-2 text-[11px] font-normal uppercase tracking-[0.12em] text-emerald-800/70">
                      Best route
                    </span>
                  ) : null}
                </p>
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
                  {leg
                    ? ` · ${formatDistanceKm(leg.distanceKm)} · ~${leg.etaMinutes} min from you`
                    : ""}
                </p>
              </div>
            </li>
          );
        })}
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
              Classic click &amp; collect
            </span>
            <span
              className={cn(
                "mt-1.5 block text-[13px] leading-snug",
                collectMode === "classic" ? "text-white/65" : "text-black/45",
              )}
            >
              Visit each shop yourself · {classicQuote.breakdown}
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
              Hybrid — consolidate to one shop
            </span>
            <span
              className={cn(
                "mt-1.5 block text-[13px] leading-snug",
                collectMode === "hybrid" ? "text-white/65" : "text-black/45",
              )}
            >
              Drivers pick from every vendor and drop at one shop you choose ·{" "}
              {formatPrice(hybridQuote.deliveryMinor / 100)} · ~
              {hybridQuote.etaMinutes} min
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
          <p className="mt-4 text-[13px] text-black/45">
            Consolidation fee {formatPrice(hybridQuote.deliveryMinor / 100)} —
            still less than delivering everything to your door from each shop.
          </p>
        </div>
      ) : null}

      {!multi ? (
        <p className="mt-6 text-[13px] text-black/45">
          Collect at this shop during today&apos;s hours — no delivery fee.
        </p>
      ) : null}

      {mapOpen && hasToken ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b1210]">
          <div className="relative min-h-0 flex-1">
            <MapCanvas
              mapStyle={style.url}
              flat={Boolean(pov.flat) && !style.terrain}
              freeCamera={pov.interactive || styleId === "map-3d"}
              pitch={
                pov.flat && styleId !== "map-3d"
                  ? 0
                  : pov.pitch || style.defaultPitch
              }
              bearing={
                pov.flat && styleId !== "map-3d"
                  ? 0
                  : pov.bearing || style.defaultBearing
              }
              center={
                userPoint
                  ? [userPoint.lng, userPoint.lat]
                  : NAIROBI_CENTER
              }
              zoom={14.2}
              markers={markers}
              routeGeoJSON={primaryRoute}
              altRoutesGeoJSON={altRoutes}
              interactive
              showNavControls={false}
              minimalControls
              fitMarkers={!primaryRoute}
              fitRoute={Boolean(primaryRoute)}
              cameraKey={`${styleId}-${povId}-${povCameraKey}`}
              onReady={(map) => {
                mapRef.current = map;
              }}
              onMarkerClick={(id) => {
                if (id === "you") return;
                onHubVendorChange(id);
              }}
              className="h-full w-full"
            />

            <div
              className={cn(
                "absolute left-3 right-3 top-3 z-30 flex items-center justify-between gap-2 sm:left-5 sm:right-5",
                frost,
                "px-3 py-2.5",
              )}
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
                  Click &amp; collect
                </p>
                <p className="truncate text-[14px] font-medium">
                  {routesLoading
                    ? "Finding routes…"
                    : tripRoutes?.bestMeta
                      ? `Best · ${formatDistanceKm(tripRoutes.bestMeta.distanceKm)} · ~${tripRoutes.bestMeta.etaMinutes} min`
                      : "Your shops"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center border border-black/10 bg-white/80"
                aria-label="Close map"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>

            <MapChrome
              className={cn(
                "absolute right-3 z-30 sm:right-5",
                dockOpen ? "bottom-36 sm:bottom-40" : "bottom-16",
              )}
              styleId={styleId}
              onStyleChange={(id) => {
                setStyleId(id);
                setPovCameraKey((k) => k + 1);
              }}
              povId={povId}
              onPovChange={(id) => {
                setPovId(id);
                setPovCameraKey((k) => k + 1);
              }}
              onRecenter={() => {
                const map = mapRef.current;
                if (!map) return;
                if (userPoint) {
                  map.flyTo({
                    center: [userPoint.lng, userPoint.lat],
                    zoom: 14.5,
                    duration: 700,
                  });
                } else {
                  map.flyTo({
                    center: NAIROBI_CENTER,
                    zoom: 12,
                    duration: 700,
                  });
                }
              }}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              compact
              collapsible
            />
          </div>

          <div className="border-t border-white/10 bg-[#f7f7f5]">
            <button
              type="button"
              onClick={() => setDockOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left sm:px-6"
              aria-expanded={dockOpen}
            >
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-[0.14em] text-black/35">
                  Pickup routes
                </span>
                <span className="block truncate text-[14px] font-medium">
                  {tripRoutes?.bestMeta
                    ? `Best to ${tripRoutes.shopLegs.find((l) => l.isBest)?.name || "shop"} · ${formatDistanceKm(tripRoutes.bestMeta.distanceKm)}`
                    : `${shopCoords.length} shop${shopCoords.length === 1 ? "" : "s"}`}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-black/40 transition-transform",
                  dockOpen && "rotate-180",
                )}
                strokeWidth={1.75}
              />
            </button>

            {dockOpen ? (
              <div className="max-h-[30vh] overflow-y-auto px-4 pb-3 sm:px-6 sm:pb-4">
                {tripRoutes?.shopLegs.length ? (
                  <ul className="space-y-1.5">
                    {tripRoutes.shopLegs.map((r, i) => (
                      <li key={r.vendorId}>
                        <button
                          type="button"
                          onClick={() => onHubVendorChange(r.vendorId)}
                          className="flex w-full justify-between gap-3 py-1.5 text-left text-[13px] text-black/55 hover:text-black"
                        >
                          <span className="font-medium text-black/75">
                            {i + 1}. {r.name}
                            {r.isBest ? (
                              <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-emerald-800/70">
                                Best
                              </span>
                            ) : null}
                            {hubVendorId === r.vendorId ? (
                              <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-black/40">
                                Hub
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular-nums">
                            {formatDistanceKm(r.distanceKm)} · ~{r.etaMinutes}{" "}
                            min
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-black/40">
                    Allow location to calculate routes from you to each shop.
                  </p>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMapOpen(false)}
                    className="inline-flex min-h-10 items-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.12em] text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end px-4 pb-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setMapOpen(false)}
                  className="inline-flex min-h-10 items-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.12em] text-white"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
