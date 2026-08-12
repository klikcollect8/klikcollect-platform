"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as MapboxMap } from "mapbox-gl";
import { ChevronDown, Navigation, X } from "lucide-react";
import { useUserLocation } from "@/components/providers/LocationProvider";
import type { MapMarker } from "@/components/map/MapCanvas";
import MapChrome, { mapGlass } from "@/components/map/MapChrome";
import AdvancedMapSearch from "@/components/map/AdvancedMapSearch";
import PlaceSheet, { RoutePanel } from "@/components/map/PlaceSheet";
import type { CheckoutVendor } from "@/lib/checkout/types";
import type { DeliveryQuote } from "@/lib/checkout/delivery-pricing";
import type { MapCommerceVendor } from "@/lib/map-commerce-types";
import {
  distanceKm,
  formatDistanceKm,
  getMapboxToken,
  NAIROBI_CENTER,
  povPreset,
  stylePreset,
  type MapPovId,
  type MapStyleId,
} from "@/lib/mapbox";
import { formatPrice } from "@/lib/currency";
import {
  fetchDirectionsAll,
  fetchIsochrone,
  searchBoxReverseMany,
  searchCategory,
  type AddressSuggestion,
  type DirectionStep,
  type TravelProfile,
} from "@/lib/mapbox-search";
import { reverseGeocodeLocation } from "@/lib/location/provider";
import {
  buildDeliveryTripRoutes,
  shopLegsToAltGeoJSON,
  type DeliveryTripRoutes,
} from "@/lib/checkout/delivery-routes";
import {
  googleStreetViewEmbedUrl,
  openExternalMaps,
} from "@/lib/external-maps";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#f7f7f5]">
      <p className="animate-pulse text-[11px] font-medium uppercase tracking-[0.22em] text-black/30">
        Loading map
      </p>
    </div>
  ),
});

const frost = mapGlass;

const NEARBY_CATEGORIES = [
  { id: "grocery", label: "Grocery" },
  { id: "supermarket", label: "Supermarket" },
  { id: "pharmacy", label: "Pharmacy" },
] as const;

type SelectedPlace = {
  id: string;
  lng: number;
  lat: number;
  name: string;
  address: string;
  featureType: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  pin: { lat: number; lng: number } | null;
  pinLabel?: string;
  vendors: CheckoutVendor[];
  quote: DeliveryQuote | null;
  /** Prefetched routes from parent — avoids duplicate Mapbox storms */
  tripRoutes?: DeliveryTripRoutes | null;
  onPinChange: (lat: number, lng: number, label?: string | null) => void;
  /** Explicit “Deliver here” — parent saves + logs + recalculates */
  onDeliverHere?: (lat: number, lng: number, label?: string | null) => void;
  onUseGps: () => void;
  gpsBusy?: boolean;
};

function toSearchVendors(vendors: CheckoutVendor[]): MapCommerceVendor[] {
  return vendors
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({
      id: v.vendorId,
      name: v.name,
      slug: v.vendorId,
      neighbourhood: v.neighbourhood || "",
      address: v.address || "",
      tagline: "",
      categories: [],
      primaryCategory: "Shop",
      color: "#111",
      productCount: 0,
      coverImage: "",
      lng: v.lng as number,
      lat: v.lat as number,
      rating: 0,
      reviewCount: 0,
      openNow: v.openNow,
      hoursLabel: v.todayLabel || "",
      pickupMinutes: 20,
      deliveryMinutes: 45,
      deliveryFee: 0,
      minOrder: 0,
      verified: true,
      featured: false,
      hasOffer: false,
      acceptsCard: true,
      acceptsMpesa: true,
      products: [],
    }));
}

function congestionLabel(samples?: string[]): string | undefined {
  if (!samples?.length) return undefined;
  const heavy = samples.filter((c) => c === "heavy" || c === "severe").length;
  const ratio = heavy / samples.length;
  if (ratio > 0.35) return "Heavy traffic";
  if (ratio > 0.15) return "Moderate traffic";
  return "Clear roads";
}

/** Full-screen checkout delivery explorer (commerce-map parity, pin-first). */
export default function CheckoutDeliveryMap({
  open,
  onClose,
  pin,
  pinLabel,
  vendors,
  quote,
  tripRoutes: tripRoutesProp,
  onPinChange,
  onDeliverHere,
  onUseGps,
  gpsBusy,
}: Props) {
  const { coords, track } = useUserLocation();
  const mapRef = useRef<MapboxMap | null>(null);
  const hasToken = Boolean(getMapboxToken());
  const pinChangeLock = useRef(false);

  const [styleId, setStyleId] = useState<MapStyleId>("street");
  const [povId, setPovId] = useState<MapPovId>("bird");
  const [povCameraKey, setPovCameraKey] = useState(0);
  const [showTraffic, setShowTraffic] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [showIsochrone, setShowIsochrone] = useState(false);
  const [isoMinutes, setIsoMinutes] = useState<10 | 20 | 30>(20);
  const [isochrone, setIsochrone] =
    useState<GeoJSON.FeatureCollection | null>(null);

  const [placeQuery, setPlaceQuery] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [placeHits, setPlaceHits] = useState<AddressSuggestion[]>([]);
  const [nearbyMarkers, setNearbyMarkers] = useState<MapMarker[]>([]);
  const [whatsHere, setWhatsHere] = useState<AddressSuggestion[]>([]);

  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    null,
  );
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  const [tripRoutesLocal, setTripRoutesLocal] =
    useState<DeliveryTripRoutes | null>(null);
  const tripRoutes = tripRoutesProp ?? tripRoutesLocal;
  const [inspectRoute, setInspectRoute] =
    useState<GeoJSON.LineString | null>(null);
  const [altRoutes, setAltRoutes] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [travel, setTravel] = useState<TravelProfile>("driving-traffic");
  const [modeEtas, setModeEtas] = useState<
    Partial<
      Record<TravelProfile, { durationS: number; distanceM: number } | null>
    >
  >({});
  const [routeSteps, setRouteSteps] = useState<DirectionStep[]>([]);
  const [routeMeta, setRouteMeta] = useState<{
    distanceM: number;
    durationS: number;
    congestion?: string;
  } | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [tripStops, setTripStops] = useState<SelectedPlace[]>([]);
  const [tripOpen, setTripOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [fitKey, setFitKey] = useState(1);

  const style = stylePreset(styleId);
  const pov = povPreset(povId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shopsKey fingerprints coords
    [shopsKey],
  );

  const searchVendors = useMemo(() => toSearchVendors(vendors), [shopsKey]);

  const userPoint = useMemo(() => {
    if (pin) return { lng: pin.lng, lat: pin.lat };
    if (coords) return { lng: coords.lng, lat: coords.lat };
    return { lng: NAIROBI_CENTER[0], lat: NAIROBI_CENTER[1] };
  }, [pin?.lat, pin?.lng, coords?.lat, coords?.lng]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Best driver trip — only if parent did not pass routes
  useEffect(() => {
    if (!open || !hasToken || !pin || tripRoutesProp) return;
    if (!shopCoords.length) {
      setTripRoutesLocal(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const trip = await buildDeliveryTripRoutes(
          { lng: pin.lng, lat: pin.lat },
          shopCoords,
        );
        if (cancelled) return;
        setTripRoutesLocal(trip);
        setFitKey((k) => k + 1);
      } catch (err) {
        console.error("[checkout-map] routes", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, hasToken, pin?.lat, pin?.lng, shopsKey, tripRoutesProp, shopCoords]);

  // Isochrone from delivery pin
  useEffect(() => {
    if (!open || !showIsochrone || !pin || !hasToken) {
      setIsochrone(null);
      return;
    }
    let cancelled = false;
    void fetchIsochrone(
      { lng: pin.lng, lat: pin.lat },
      {
        profile:
          travel === "walking"
            ? "walking"
            : travel === "cycling"
              ? "cycling"
              : "driving",
        contoursMinutes: [isoMinutes],
      },
    ).then((fc) => {
      if (!cancelled) setIsochrone(fc || null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, showIsochrone, pin, hasToken, travel, isoMinutes]);

  // Inspect: for a bag shop show best shop→home; for a place show pin↔place
  useEffect(() => {
    if (!open || !pin || !hasToken) return;
    const shop =
      selectedShopId &&
      vendors.find(
        (v) =>
          v.vendorId === selectedShopId && v.lat != null && v.lng != null,
      );
    const dest = selectedPlace;

    if (!shop && !dest) {
      setInspectRoute(null);
      setAltRoutes(null);
      setRouteSteps([]);
      setRouteMeta(null);
      setModeEtas({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const home = { lng: pin.lng, lat: pin.lat };
      // Driver direction for shops: shop → home. Places: pin → place.
      const from = shop
        ? { lng: shop.lng as number, lat: shop.lat as number }
        : home;
      const to = shop
        ? home
        : { lng: dest!.lng, lat: dest!.lat };
      const modes: TravelProfile[] = ["driving-traffic", "walking", "cycling"];
      const etas: Partial<
        Record<TravelProfile, { durationS: number; distanceM: number } | null>
      > = {};
      await Promise.all(
        modes.map(async (m) => {
          const routes = await fetchDirectionsAll(from, to, m, {
            alternatives: m === travel,
          });
          // Prefer fastest alternative when inspecting
          const primary = [...routes].sort(
            (a, b) => a.durationS - b.durationS || a.distanceM - b.distanceM,
          )[0];
          etas[m] = primary
            ? { durationS: primary.durationS, distanceM: primary.distanceM }
            : null;
          if (m === travel && primary) {
            if (cancelled) return;
            setInspectRoute(primary.geometry);
            setRouteSteps(primary.steps || []);
            setRouteMeta({
              distanceM: primary.distanceM,
              durationS: primary.durationS,
              congestion: congestionLabel(primary.annotations?.congestion),
            });
            const alts = routes.filter((r) => r !== primary);
            setAltRoutes(
              alts.length
                ? {
                    type: "FeatureCollection",
                    features: alts.map((r, i) => ({
                      type: "Feature",
                      properties: { index: i + 1 },
                      geometry: r.geometry,
                    })),
                  }
                : null,
            );
          }
        }),
      );
      if (!cancelled) setModeEtas(etas);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pin, hasToken, selectedPlace, selectedShopId, travel, vendors]);

  const driverRoute = tripRoutes?.driverRoute ?? null;
  const shopAltRoutes = useMemo(() => {
    if (inspectRoute || !tripRoutes?.shopLegs.length) return null;
    if (tripRoutes.shopLegs.length <= 1) return null;
    return shopLegsToAltGeoJSON(tripRoutes.shopLegs);
  }, [tripRoutes, inspectRoute]);

  const routeGeoJSON = inspectRoute || driverRoute;
  const altRoutesGeoJSON = inspectRoute ? altRoutes : shopAltRoutes;

  const markers = useMemo(() => {
    const list: MapMarker[] = [];
    if (pin) {
      list.push({
        id: "delivery",
        lng: pin.lng,
        lat: pin.lat,
        kind: "dropoff",
        label: "Deliver here",
        active: true,
        pulse: true,
      });
    }
    const order = tripRoutes?.stopOrder || [];
    vendors
      .filter((v) => v.lat != null && v.lng != null)
      .forEach((v) => {
        const stopIndex = order.indexOf(v.vendorId);
        const leg = tripRoutes?.shopLegs.find(
          (l) => l.vendorId === v.vendorId,
        );
        list.push({
          id: v.vendorId,
          lng: v.lng as number,
          lat: v.lat as number,
          kind: "stop",
          label: v.name,
          stopIndex: stopIndex >= 0 ? stopIndex + 1 : undefined,
          active: selectedShopId === v.vendorId || Boolean(leg?.isBest),
        });
      });
    if (selectedPlace) {
      list.push({
        id: selectedPlace.id,
        lng: selectedPlace.lng,
        lat: selectedPlace.lat,
        kind: "place",
        label: selectedPlace.name,
        active: true,
      });
    }
    list.push(...nearbyMarkers);
    return list;
  }, [pin, vendors, selectedPlace, selectedShopId, nearbyMarkers, tripRoutes]);

  const selectPlace = useCallback((place: SelectedPlace) => {
    setSelectedPlace(place);
    setSelectedShopId(null);
    setListOpen(false);
    setStatusMsg(null);
  }, []);

  const runCategorySearch = async (categoryId: string) => {
    if (!hasToken) return;
    setPlaceBusy(true);
    setActiveCategory(categoryId);
    setStatusMsg("Finding nearby…");
    try {
      const hits = await searchCategory(categoryId, {
        proximity: userPoint,
        limit: 12,
      });
      setPlaceHits(hits);
      setNearbyMarkers(
        hits
          .filter((h) => h.lng != null && h.lat != null)
          .map((h) => ({
            id: h.id,
            lng: h.lng as number,
            lat: h.lat as number,
            kind: "place" as const,
            label: h.name,
            pulse: true,
          })),
      );
      setStatusMsg(
        hits.length
          ? `${hits.length} nearby`
          : "No places found in this category",
      );
      setFitKey((k) => k + 1);
    } finally {
      setPlaceBusy(false);
    }
  };

  const onMapClick = async ({ lng, lat }: { lng: number; lat: number }) => {
    if (pinChangeLock.current) return;
    pinChangeLock.current = true;
    try {
      let label: string | null = null;
      if (hasToken) {
        try {
          // Cached provider reverse — the parent re-uses the same cache entry,
          // so the pin change costs one Mapbox call, not two.
          const hit = await reverseGeocodeLocation(lng, lat);
          label = hit?.label || null;
          const related = await searchBoxReverseMany(lng, lat, { limit: 5 });
          setWhatsHere(related);
        } catch {
          /* geocode optional */
        }
      }
      const save = onDeliverHere || onPinChange;
      save(lat, lng, label);
      setSelectedPlace({
        id: `pin_${lng.toFixed(5)}_${lat.toFixed(5)}`,
        lng,
        lat,
        name: label?.split(",")[0] || "Deliver here",
        address: label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        featureType: "address",
      });
      setSelectedShopId(null);
      setInspectRoute(null);
      setStatusMsg("Pin saved · recalculating delivery");
      setDockOpen(true);
    } finally {
      window.setTimeout(() => {
        pinChangeLock.current = false;
      }, 400);
    }
  };

  const deliverAt = (lat: number, lng: number, label?: string | null) => {
    const save = onDeliverHere || onPinChange;
    save(lat, lng, label);
    setInspectRoute(null);
    setStatusMsg("Deliver here saved · recalculating");
    setDockOpen(true);
  };

  const flyTo = (lng: number, lat: number, zoom = 15.5) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom,
      essential: true,
      duration: 800,
    });
  };

  const activeSheetPlace = selectedPlace
    ? selectedPlace
    : selectedShopId
      ? (() => {
          const v = vendors.find((x) => x.vendorId === selectedShopId);
          if (!v || v.lat == null || v.lng == null) return null;
          return {
            id: v.vendorId,
            lng: v.lng,
            lat: v.lat,
            name: v.name,
            address: v.address || v.neighbourhood || "",
            featureType: "shop",
          } satisfies SelectedPlace;
        })()
      : null;

  const placeDist =
    activeSheetPlace && pin
      ? distanceKm(
          { lat: pin.lat, lng: pin.lng },
          { lat: activeSheetPlace.lat, lng: activeSheetPlace.lng },
        )
      : null;

  const streetViewSrc = activeSheetPlace
    ? googleStreetViewEmbedUrl({
        lat: activeSheetPlace.lat,
        lng: activeSheetPlace.lng,
        label: activeSheetPlace.name,
      })
    : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#f7f7f5]">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.08] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight">
            Delivery map
          </p>
          <p className="truncate text-[12px] text-black/45">
            Green = best driver trip to your door · grey = each shop→home
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center text-black/70 hover:opacity-60"
          aria-label="Close map"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!hasToken ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[15px] text-black/45">
            Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the map.
          </div>
        ) : (
          <>
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
              center={[userPoint.lng, userPoint.lat]}
              zoom={styleId === "map-3d" ? 14.2 : 13.5}
              markers={markers}
              routeGeoJSON={routeGeoJSON}
              altRoutesGeoJSON={altRoutesGeoJSON}
              isochroneGeoJSON={isochrone}
              showTraffic={showTraffic}
              interactive
              showNavControls={false}
              minimalControls
              fitMarkers={!routeGeoJSON ? fitKey : false}
              fitRoute={Boolean(routeGeoJSON)}
              animateRoute
              cameraKey={`${styleId}-${povId}-${povCameraKey}`}
              onReady={(map) => {
                mapRef.current = map;
              }}
              onMapClick={(ll) => void onMapClick(ll)}
              onMarkerClick={(id) => {
                if (id === "delivery") return;
                const shop = vendors.find((v) => v.vendorId === id);
                if (shop && shop.lat != null && shop.lng != null) {
                  setSelectedShopId(id);
                  setSelectedPlace(null);
                  return;
                }
                const hit = placeHits.find((h) => h.id === id);
                if (hit?.lng != null && hit.lat != null) {
                  selectPlace({
                    id: hit.id,
                    lng: hit.lng,
                    lat: hit.lat,
                    name: hit.name,
                    address: hit.fullAddress || hit.name,
                    featureType: hit.featureType || "poi",
                  });
                }
              }}
              className="h-full w-full"
            />

            {/* Search + categories */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-4">
              <div className="pointer-events-auto w-[min(100%,28rem)]">
                <div className={cn("overflow-visible", frost)}>
                  <div className="px-1.5">
                    <AdvancedMapSearch
                      value={placeQuery}
                      map={mapRef.current}
                      proximity={userPoint}
                      vendors={searchVendors}
                      placeholder="Search places, streets, shops…"
                      onChange={setPlaceQuery}
                      onClear={() => {
                        setPlaceQuery("");
                        setPlaceHits([]);
                        setNearbyMarkers([]);
                        setActiveCategory(null);
                        setSelectedPlace(null);
                        setStatusMsg(null);
                      }}
                      onPlaceSelect={(place) => {
                        selectPlace({
                          id: place.id,
                          lng: place.lng,
                          lat: place.lat,
                          name: place.name,
                          address: place.address,
                          featureType: place.featureType,
                        });
                        setPlaceQuery(place.name);
                        flyTo(place.lng, place.lat);
                      }}
                      onVendorSelect={(id) => {
                        setSelectedShopId(id);
                        setSelectedPlace(null);
                        const v = vendors.find((x) => x.vendorId === id);
                        if (v?.lng != null && v.lat != null) {
                          flyTo(v.lng, v.lat);
                        }
                      }}
                      onCategorySelect={(id) => void runCategorySearch(id)}
                    />
                  </div>
                </div>

                <div className="scrollbar-hide mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                  {NEARBY_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void runCategorySearch(c.id)}
                      className={cn(
                        "h-8 shrink-0 px-3 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
                        frost,
                        activeCategory === c.id
                          ? "bg-black/90 text-white"
                          : "text-black/50 hover:text-black",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowTraffic((v) => !v)}
                    className={cn(
                      "h-8 shrink-0 px-3 text-[10px] font-medium uppercase tracking-[0.12em]",
                      frost,
                      showTraffic
                        ? "bg-black/90 text-white"
                        : "text-black/50 hover:text-black",
                    )}
                  >
                    Traffic
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIsochrone((v) => !v)}
                    className={cn(
                      "h-8 shrink-0 px-3 text-[10px] font-medium uppercase tracking-[0.12em]",
                      frost,
                      showIsochrone
                        ? "bg-black/90 text-white"
                        : "text-black/50 hover:text-black",
                    )}
                  >
                    Reach
                  </button>
                  {showIsochrone
                    ? ([10, 20, 30] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setIsoMinutes(m)}
                          className={cn(
                            "h-8 shrink-0 px-2.5 text-[10px] font-medium tabular-nums",
                            frost,
                            isoMinutes === m
                              ? "bg-black/80 text-white"
                              : "text-black/45",
                          )}
                        >
                          {m}m
                        </button>
                      ))
                    : null}
                </div>

                {statusMsg || placeBusy ? (
                  <p
                    className={cn(
                      "mt-2 truncate px-3 py-2 text-[12px] text-black/50",
                      frost,
                    )}
                  >
                    {placeBusy ? "Finding nearby…" : statusMsg}
                  </p>
                ) : null}

                {!placeBusy && placeHits.length > 0 && activeCategory ? (
                  <div
                    className={cn(
                      "scrollbar-hide mt-2 max-h-[28vh] overflow-y-auto",
                      frost,
                    )}
                  >
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/40">
                        Nearby · {placeHits.length}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setPlaceHits([]);
                          setNearbyMarkers([]);
                          setActiveCategory(null);
                        }}
                        className="text-[11px] text-black/40 hover:text-black"
                      >
                        Clear
                      </button>
                    </div>
                    <ul>
                      {placeHits.slice(0, 8).map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (s.lng == null || s.lat == null) return;
                              selectPlace({
                                id: s.id,
                                lng: s.lng,
                                lat: s.lat,
                                name: s.name,
                                address: s.fullAddress || s.name,
                                featureType: s.featureType || "poi",
                              });
                              flyTo(s.lng, s.lat);
                            }}
                            className="flex w-full items-start justify-between gap-3 border-t border-black/[0.05] px-3 py-2.5 text-left hover:bg-white/40"
                          >
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium">
                                {s.name}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-black/40">
                                {s.fullAddress || s.featureType}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <MapChrome
              className={cn(
                "absolute right-3 z-30 sm:right-5",
                dockOpen ? "bottom-40 sm:bottom-44" : "bottom-20",
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
                if (pin) flyTo(pin.lng, pin.lat, 15);
                else if (coords) flyTo(coords.lng, coords.lat, 15);
                else flyTo(NAIROBI_CENTER[0], NAIROBI_CENTER[1], 12);
              }}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onListToggle={() => setListOpen((v) => !v)}
              listOpen={listOpen}
              compact
              collapsible
            />

            {listOpen ? (
              <div
                className={cn(
                  "absolute bottom-36 left-3 z-30 max-h-[40vh] w-[min(100%-4rem,20rem)] overflow-y-auto sm:left-5",
                  frost,
                )}
              >
                <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-black/40">
                  Driver pickups ·{" "}
                  {tripRoutes?.shopLegs.length || vendors.length}
                </p>
                <ul>
                  {(tripRoutes?.shopLegs.length
                    ? tripRoutes.shopLegs
                    : vendors
                        .filter((v) => v.lat != null)
                        .map((v) => ({
                          vendorId: v.vendorId,
                          name: v.name,
                          distanceKm: pin
                            ? distanceKm(
                                { lat: pin.lat, lng: pin.lng },
                                { lat: v.lat!, lng: v.lng! },
                              )
                            : 0,
                          etaMinutes: 0,
                          geometry: {
                            type: "LineString" as const,
                            coordinates: [],
                          },
                          isBest: false,
                        }))
                  ).map((r, i) => (
                    <li key={r.vendorId}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedShopId(r.vendorId);
                          setSelectedPlace(null);
                          const v = vendors.find(
                            (x) => x.vendorId === r.vendorId,
                          );
                          if (v?.lng != null && v.lat != null) {
                            flyTo(v.lng, v.lat);
                          }
                        }}
                        className="flex w-full items-center justify-between gap-2 border-t border-black/[0.05] px-3 py-2.5 text-left text-[13px] hover:bg-white/40"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {i + 1}. {r.name}
                          {"isBest" in r && r.isBest ? (
                            <span className="ml-1.5 text-[10px] uppercase tracking-[0.1em] text-emerald-800/70">
                              Fastest
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums text-[12px] text-black/45">
                          {r.distanceKm > 0
                            ? formatDistanceKm(r.distanceKm)
                            : "—"}
                          {r.etaMinutes
                            ? ` · ~${r.etaMinutes}m`
                            : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeSheetPlace && !listOpen ? (
              <PlaceSheet
                place={{
                  id: activeSheetPlace.id,
                  lng: activeSheetPlace.lng,
                  lat: activeSheetPlace.lat,
                  name: activeSheetPlace.name,
                  address: activeSheetPlace.address,
                  featureType: activeSheetPlace.featureType,
                  isVendor: Boolean(selectedShopId),
                  hoursLabel: selectedShopId
                    ? vendors.find((v) => v.vendorId === selectedShopId)
                        ?.todayLabel
                    : undefined,
                  openNow: selectedShopId
                    ? vendors.find((v) => v.vendorId === selectedShopId)
                        ?.openNow
                    : undefined,
                }}
                distanceKm={placeDist}
                congestion={routeMeta?.congestion}
                streetViewSrc={streetViewSrc}
                tripCount={tripStops.length}
                whatsHere={whatsHere.map((w) => ({
                  id: w.id,
                  name: w.name,
                  featureType: w.featureType,
                }))}
                onClose={() => {
                  setSelectedPlace(null);
                  setSelectedShopId(null);
                  setWhatsHere([]);
                }}
                onFlyHere={() =>
                  flyTo(activeSheetPlace.lng, activeSheetPlace.lat, 16.2)
                }
                onStreetView={() =>
                  openExternalMaps(
                    {
                      lng: activeSheetPlace.lng,
                      lat: activeSheetPlace.lat,
                      label: activeSheetPlace.name,
                    },
                    "streetview",
                  )
                }
                onOpenMaps={() =>
                  openExternalMaps(
                    {
                      lng: activeSheetPlace.lng,
                      lat: activeSheetPlace.lat,
                      label: activeSheetPlace.name,
                    },
                    "place",
                  )
                }
                onCopy={() => {
                  void navigator.clipboard
                    ?.writeText(
                      `${activeSheetPlace.lat.toFixed(5)}, ${activeSheetPlace.lng.toFixed(5)}`,
                    )
                    .then(() => setStatusMsg("Coordinates copied"));
                }}
                onShare={() => {
                  const url = `https://www.google.com/maps?q=${activeSheetPlace.lat},${activeSheetPlace.lng}`;
                  void navigator.clipboard
                    ?.writeText(url)
                    .then(() => setStatusMsg("Share link copied"));
                }}
                onPickRelated={(id) => {
                  const w = whatsHere.find((x) => x.id === id);
                  if (w?.lng != null && w.lat != null) {
                    selectPlace({
                      id: w.id,
                      lng: w.lng,
                      lat: w.lat,
                      name: w.name,
                      address: w.fullAddress || w.name,
                      featureType: w.featureType || "place",
                    });
                  }
                }}
              />
            ) : null}

            {activeSheetPlace && !listOpen ? (
              <RoutePanel
                travel={travel}
                modeEtas={modeEtas}
                stepsOpen={stepsOpen}
                routeSteps={routeSteps}
                inTrip={tripStops.some((s) => s.id === activeSheetPlace.id)}
                tripStops={tripStops}
                orderedIds={tripStops.map((s) => s.id)}
                tripOpen={tripOpen}
                totalMeta={routeMeta}
                hasDestination
                onTravelChange={setTravel}
                onNavigate={() =>
                  openExternalMaps(
                    {
                      lng: activeSheetPlace.lng,
                      lat: activeSheetPlace.lat,
                      label: activeSheetPlace.name,
                    },
                    "directions",
                    pin || coords || undefined,
                    {
                      travelMode:
                        travel === "walking"
                          ? "walking"
                          : travel === "cycling"
                            ? "bicycling"
                            : "driving",
                    },
                  )
                }
                onToggleSteps={() => setStepsOpen((v) => !v)}
                onAddStop={() => {
                  setTripStops((prev) => {
                    if (prev.some((s) => s.id === activeSheetPlace.id))
                      return prev;
                    if (prev.length >= 11) return prev;
                    return [...prev, activeSheetPlace];
                  });
                  setTripOpen(true);
                }}
                onRemoveStop={() =>
                  setTripStops((prev) =>
                    prev.filter((s) => s.id !== activeSheetPlace.id),
                  )
                }
                onOpenTrip={() => setTripOpen(true)}
                onCloseTrip={() => setTripOpen(false)}
                onRemoveTripStop={(id) =>
                  setTripStops((prev) => prev.filter((s) => s.id !== id))
                }
                onSelectTripStop={(id) => {
                  const s = tripStops.find((x) => x.id === id);
                  if (s) selectPlace(s);
                }}
                onClearTrip={() => {
                  setTripStops([]);
                  setTripOpen(false);
                }}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-black/[0.08] bg-[#f7f7f5]">
        <button
          type="button"
          onClick={() => setDockOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left sm:px-6"
          aria-expanded={dockOpen}
        >
          <span className="min-w-0">
            <span className="block text-[11px] uppercase tracking-[0.14em] text-black/35">
              Deliver to
            </span>
            <span className="block truncate text-[14px] font-medium">
              {pinLabel ||
                (pin
                  ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
                  : "Tap map to pin")}
              {quote
                ? ` · ${formatPrice(quote.deliveryMinor / 100)}`
                : ""}
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
          <div className="max-h-[32vh] overflow-y-auto px-4 pb-3 sm:px-6 sm:pb-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                {quote ? (
                  <p className="text-[13px] text-black/45">
                    ~{quote.etaMinutes} min
                    {quote.distanceKm > 0
                      ? ` · ${formatDistanceKm(quote.distanceKm)}`
                      : ""}
                    {tripRoutes?.driverMeta
                      ? ` · best driver ${formatDistanceKm(tripRoutes.driverMeta.distanceKm)}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-[13px] text-black/40">
                    Tap the map or Deliver here to save this pin
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeSheetPlace ? (
                  <button
                    type="button"
                    onClick={() =>
                      deliverAt(
                        activeSheetPlace.lat,
                        activeSheetPlace.lng,
                        activeSheetPlace.address || activeSheetPlace.name,
                      )
                    }
                    className="inline-flex min-h-11 items-center border border-black/15 bg-white px-4 text-[12px] font-medium uppercase tracking-[0.12em]"
                  >
                    Deliver here
                  </button>
                ) : pin ? (
                  <button
                    type="button"
                    onClick={() =>
                      deliverAt(pin.lat, pin.lng, pinLabel || null)
                    }
                    className="inline-flex min-h-11 items-center border border-black/15 bg-white px-4 text-[12px] font-medium uppercase tracking-[0.12em]"
                  >
                    Save pin
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onUseGps}
                  disabled={gpsBusy}
                  className="inline-flex min-h-11 items-center gap-1.5 border border-black/15 bg-white px-4 text-[12px] font-medium uppercase tracking-[0.12em] disabled:opacity-40"
                >
                  <Navigation className="h-3.5 w-3.5" strokeWidth={1.75} />
                  GPS
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex min-h-11 items-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.12em] text-white"
                >
                  Done
                </button>
              </div>
            </div>
            {tripRoutes?.shopLegs.length ? (
              <ul className="mt-3 space-y-1.5 border-t border-black/[0.06] pt-3">
                {tripRoutes.shopLegs.map((r, i) => (
                  <li
                    key={r.vendorId}
                    className="flex justify-between gap-3 text-[13px] text-black/55"
                  >
                    <span className="font-medium text-black/75">
                      {i + 1}. {r.name}
                      {r.isBest ? (
                        <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-emerald-800/70">
                          Fastest
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">
                      {formatDistanceKm(r.distanceKm)} · ~{r.etaMinutes} min
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="flex justify-end gap-2 px-4 pb-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-10 items-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.12em] text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
