"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import mapboxgl from "mapbox-gl";
import { X } from "lucide-react";
import { useUserLocation } from "@/components/providers/LocationProvider";
import type { MapMarker } from "@/components/map/MapCanvas";
import MapChrome, { mapGlass } from "@/components/map/MapChrome";
import AdvancedMapSearch from "@/components/map/AdvancedMapSearch";
import PlaceSheet, { RoutePanel } from "@/components/map/PlaceSheet";
import {
  vendorsToGeoJSON,
  type MapCommerceVendor,
} from "@/lib/map-commerce-types";
import {
  distanceKm,
  formatDistanceKm,
  formatDuration,
  getMapboxToken,
  MAP_FLAT_ZOOM,
  NAIROBI_CENTER,
  povPreset,
  stylePreset,
  type MapPovId,
  type MapStyleId,
} from "@/lib/mapbox";
import {
  featureTypeLabel,
  fetchDirectionsAll,
  fetchEtasFromOrigin,
  fetchIsochrone,
  fetchOptimizedTrip,
  matchTraceToRoads,
  retrieveAddress,
  searchBoxReverse,
  searchBoxReverseMany,
  searchCategory,
  type AddressSuggestion,
  type DirectionStep,
  type TravelProfile,
} from "@/lib/mapbox-search";
import {
  googleStreetViewEmbedUrl,
  openExternalMaps,
} from "@/lib/external-maps";
import { cn } from "@/lib/utils";

/** Category chips — only grocery / supermarket / pharmacy */
const NEARBY_CATEGORIES = [
  { id: "grocery", label: "Grocery" },
  { id: "supermarket", label: "Supermarket" },
  { id: "pharmacy", label: "Pharmacy" },
] as const;

/** Always marked — grocery + supermarket (vendors come from vendorGeoJSON) */
const ALWAYS_MARK_CATEGORIES = ["grocery", "supermarket"] as const;

const ALLOWED_CATEGORY_IDS = new Set<string>([
  ...ALWAYS_MARK_CATEGORIES,
  "pharmacy",
]);

type SelectedPlace = {
  id: string;
  lng: number;
  lat: number;
  name: string;
  address: string;
  featureType: string;
};

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[var(--kc-canvas)]">
      <p className="animate-pulse text-[11px] font-medium uppercase tracking-[0.22em] text-black/30">
        Loading map
      </p>
    </div>
  ),
});

const frost = mapGlass;

type CommercePayload = { vendors: MapCommerceVendor[] };
type SortKey = "nearest" | "rating" | "fastest";
type RadiusKm = 0 | 2 | 5 | 10;

export default function CommerceMapPage() {
  const { coords, track, status: locStatus } = useUserLocation();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const fittedOnce = useRef(false);
  const searchSession = useRef<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const gpsTrailRef = useRef<Array<{ lng: number; lat: number }>>([]);

  const [vendors, setVendors] = useState<MapCommerceVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hood, setHood] = useState("all");
  const [category, setCategory] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("nearest");
  const [radiusKm, setRadiusKm] = useState<RadiusKm>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<MapStyleId>("street");
  const [povId, setPovId] = useState<MapPovId>("top");
  const [povCameraKey, setPovCameraKey] = useState(0);
  const [showVendors, setShowVendors] = useState(true);

  const [route, setRoute] = useState<GeoJSON.LineString | null>(null);
  const [routeMeta, setRouteMeta] = useState<{
    distanceM: number;
    durationS: number;
    congestion?: string;
  } | null>(null);
  const [routeSteps, setRouteSteps] = useState<DirectionStep[]>([]);
  const [travel, setTravel] = useState<TravelProfile>("driving-traffic");
  const [modeEtas, setModeEtas] = useState<
    Partial<
      Record<TravelProfile, { durationS: number; distanceM: number } | null>
    >
  >({});
  const [tripStops, setTripStops] = useState<SelectedPlace[]>([]);
  const [orderedStopIds, setOrderedStopIds] = useState<string[]>([]);
  const [tripOpen, setTripOpen] = useState(false);
  const [tripBusy, setTripBusy] = useState(false);
  const [showAlts, setShowAlts] = useState(true);
  const [routeFromPin, setRouteFromPin] = useState(false);

  const [cameraKey, setCameraKey] = useState(0);
  const [center, setCenter] = useState<[number, number]>(NAIROBI_CENTER);
  const [placeMarker, setPlaceMarker] = useState<MapMarker | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    null,
  );
  const [nearbyMarkers, setNearbyMarkers] = useState<MapMarker[]>([]);
  /** Persistent Mapbox POIs for grocery / markets / shops */
  const [commerceMarkers, setCommerceMarkers] = useState<MapMarker[]>([]);
  const [commerceHits, setCommerceHits] = useState<AddressSuggestion[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [fitKey, setFitKey] = useState(0);

  const [listOpen, setListOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  const [placeQuery, setPlaceQuery] = useState("");
  const [placeHits, setPlaceHits] = useState<AddressSuggestion[]>([]);
  const [whatsHere, setWhatsHere] = useState<AddressSuggestion[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);

  const [routeOrigin, setRouteOrigin] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [altRoutes, setAltRoutes] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [showIsochrone, setShowIsochrone] = useState(false);
  const [isoMinutes, setIsoMinutes] = useState<15 | 30 | 45>(30);
  const [isochrone, setIsochrone] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [matchedRoute, setMatchedRoute] =
    useState<GeoJSON.LineString | null>(null);
  const [trailCount, setTrailCount] = useState(0);
  const [matrixEtas, setMatrixEtas] = useState<
    Record<string, { durationS: number | null; distanceM: number | null }>
  >({});

  useEffect(() => {
    track();
  }, [track]);

  useEffect(() => {
    if (!coords) return;
    const next = { lng: coords.lng, lat: coords.lat };
    const trail = gpsTrailRef.current;
    const last = trail[trail.length - 1];
    if (
      last &&
      Math.abs(last.lng - next.lng) < 0.00005 &&
      Math.abs(last.lat - next.lat) < 0.00005
    ) {
      return;
    }
    gpsTrailRef.current = [...trail, next].slice(-40);
    setTrailCount(gpsTrailRef.current.length);
  }, [coords]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/map/commerce")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message || "Failed");
        return j.data as CommercePayload;
      })
      .then((data) => {
        if (!cancelled) setVendors(data?.vendors || []);
      })
      .catch(() => {
        if (!cancelled) setVendors([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userPoint = useMemo(() => {
    if (!coords) return null;
    return { lat: coords.lat, lng: coords.lng };
  }, [coords]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendors) {
      if (v.primaryCategory) set.add(v.primaryCategory);
    }
    return Array.from(set).sort();
  }, [vendors]);

  const neighbourhoods = useMemo(
    () =>
      [...new Set(vendors.map((v) => v.neighbourhood).filter(Boolean))].sort(),
    [vendors],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = vendors.filter((v) => {
      if (openOnly && !v.openNow) return false;
      if (verifiedOnly && !v.verified) return false;
      if (offersOnly && !v.hasOffer) return false;
      if (hood !== "all" && v.neighbourhood !== hood) return false;
      if (category !== "all") {
        const cats = [v.primaryCategory, ...(v.categories || [])];
        if (!cats.includes(category)) return false;
      }
      if (radiusKm > 0 && userPoint) {
        if (distanceKm(userPoint, { lat: v.lat, lng: v.lng }) > radiusKm) {
          return false;
        }
      }
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.neighbourhood.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q) ||
        v.tagline.toLowerCase().includes(q) ||
        (v.primaryCategory || "").toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      if (sort === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sort === "fastest") return a.pickupMinutes - b.pickupMinutes;
      if (!userPoint) return a.name.localeCompare(b.name);
      return (
        distanceKm(userPoint, { lat: a.lat, lng: a.lng }) -
        distanceKm(userPoint, { lat: b.lat, lng: b.lng })
      );
    });
    return list;
  }, [
    vendors,
    query,
    hood,
    category,
    openOnly,
    verifiedOnly,
    offersOnly,
    radiusKm,
    sort,
    userPoint,
  ]);

  const selected = useMemo(
    () => vendors.find((v) => v.id === selectedId) || null,
    [vendors, selectedId],
  );

  const selectedDist = useMemo(() => {
    if (!selected || !userPoint) return null;
    return distanceKm(userPoint, { lat: selected.lat, lng: selected.lng });
  }, [selected, userPoint]);

  const vendorGeoJSON = useMemo(() => {
    if (!showVendors) {
      return { type: "FeatureCollection" as const, features: [] };
    }
    // Always mark every KlikCollect shop/market on the map
    return vendorsToGeoJSON(vendors, {
      activeId: selectedId,
      hoveredId,
      highlightIds: new Set(vendors.map((v) => v.id)),
    });
  }, [vendors, selectedId, hoveredId, showVendors]);

  // Always load grocery / supermarket / shopping POIs around the user
  useEffect(() => {
    let cancelled = false;
    const prox = userPoint || {
      lng: NAIROBI_CENTER[0],
      lat: NAIROBI_CENTER[1],
    };
    void Promise.all(
      ALWAYS_MARK_CATEGORIES.map((id) =>
        searchCategory(id, { proximity: prox, limit: 25 }),
      ),
    ).then((groups) => {
      if (cancelled) return;
      const byId = new Map<string, AddressSuggestion>();
      for (const hits of groups) {
        for (const h of hits) {
          if (h.lng != null && h.lat != null) byId.set(h.id, h);
        }
      }
      const list = [...byId.values()];
      setCommerceHits(list);
      setCommerceMarkers(
        list.map((h) => ({
          id: h.id,
          lng: h.lng!,
          lat: h.lat!,
          kind: "place" as const,
          label: h.name,
          pulse: false,
          active: false,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [userPoint?.lat, userPoint?.lng]);

  const markers = useMemo((): MapMarker[] => {
    const list: MapMarker[] = [];
    if (userPoint) {
      list.push({
        id: "you",
        lng: userPoint.lng,
        lat: userPoint.lat,
        kind: "user",
      });
    }
    const stopIdSet = new Set(tripStops.map((s) => s.id));
    const order =
      orderedStopIds.length === tripStops.length
        ? orderedStopIds
        : tripStops.map((s) => s.id);

    const seen = new Set<string>();

    // Persistent commerce POIs (grocery / supermarket only)
    for (const m of commerceMarkers) {
      if (stopIdSet.has(m.id) || seen.has(m.id)) continue;
      seen.add(m.id);
      list.push({
        ...m,
        pulse: false,
        active: selectedPlace?.id === m.id || m.active,
      });
    }

    // Extra category markers — pharmacy (or grocery/supermarket refresh) only
    const allowNearby =
      activeCategory != null && ALLOWED_CATEGORY_IDS.has(activeCategory);
    if (allowNearby) {
      for (const m of nearbyMarkers) {
        if (stopIdSet.has(m.id) || seen.has(m.id)) continue;
        seen.add(m.id);
        list.push({
          ...m,
          pulse: false,
          active: selectedPlace?.id === m.id || m.active,
        });
      }
    }

    order.forEach((id, i) => {
      const s = tripStops.find((x) => x.id === id);
      if (!s) return;
      list.push({
        id: `stop_${s.id}`,
        lng: s.lng,
        lat: s.lat,
        kind: "stop",
        label: s.name,
        stopIndex: i + 1,
        pulse: true,
        active: selectedPlace?.id === s.id,
      });
    });

    if (
      placeMarker &&
      !stopIdSet.has(selectedPlace?.id || "") &&
      !seen.has(placeMarker.id)
    ) {
      list.push({
        ...placeMarker,
        active: true,
        pulse: false,
      });
    }
    return list;
  }, [
    userPoint,
    placeMarker,
    nearbyMarkers,
    commerceMarkers,
    tripStops,
    orderedStopIds,
    activeCategory,
    selectedPlace?.id,
  ]);

  const placeDist = useMemo(() => {
    if (!selectedPlace || !userPoint) return null;
    return distanceKm(userPoint, {
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
    });
  }, [selectedPlace, userPoint]);

  const preset = stylePreset(styleId);
  const pov = povPreset(povId);
  const mapFlat = Boolean(pov.flat);
  const mapFree = Boolean(pov.interactive);
  const mapPitch = mapFlat && !mapFree ? 0 : pov.pitch;
  const mapBearing = mapFlat && !mapFree ? 0 : pov.bearing;

  const applyPov = useCallback((id: MapPovId) => {
    setPovId(id);
    setPovCameraKey((n) => n + 1);
    const p = povPreset(id);
    const map = mapRef.current;
    if (!map) return;
    const nextFlat = Boolean(p.flat);
    const nextFree = Boolean(p.interactive);
    const nextPitch = nextFlat && !nextFree ? 0 : p.pitch;
    const nextBearing = nextFlat && !nextFree ? 0 : p.bearing;
    const allowTilt = nextFree || !nextFlat;
    const run = () => {
      try {
        map.setMaxPitch(allowTilt ? 85 : 0);
        if (allowTilt) {
          map.dragRotate.enable();
          map.touchPitch.enable();
        } else {
          map.dragRotate.disable();
          map.touchPitch.disable();
        }
        map.easeTo({
          pitch: nextPitch,
          bearing: nextBearing,
          duration: 700,
          essential: true,
        });
      } catch {
        /* map may be swapping styles */
      }
    };
    if (map.isStyleLoaded()) run();
    else map.once("style.load", run);
  }, []);

  const resolveOrigin = useCallback(() => {
    if (routeFromPin && placeMarker) {
      return { lat: placeMarker.lat, lng: placeMarker.lng };
    }
    return userPoint ? { ...userPoint } : null;
  }, [routeFromPin, placeMarker, userPoint]);

  const routeDestination = useMemo(() => {
    if (tripStops.length >= 1) return null;
    if (selected) {
      return {
        id: selected.id,
        lng: selected.lng,
        lat: selected.lat,
        label: selected.name,
      };
    }
    if (selectedPlace) {
      return {
        id: selectedPlace.id,
        lng: selectedPlace.lng,
        lat: selectedPlace.lat,
        label: selectedPlace.name,
      };
    }
    return null;
  }, [selected, selectedPlace, tripStops.length]);

  const applyRouteResult = useCallback(
    (
      primary: {
        geometry: GeoJSON.LineString;
        distanceM: number;
        durationS: number;
        steps?: DirectionStep[];
        annotations?: { congestion?: string[] };
      } | null,
      alts: Array<{
        geometry: GeoJSON.LineString;
        distanceM: number;
        durationS: number;
      }> = [],
    ) => {
      if (!primary) {
        setRoute(null);
        setRouteMeta(null);
        setRouteSteps([]);
        setAltRoutes(null);
        return;
      }
      const congestion = primary.annotations?.congestion;
      let congestionLabel: string | undefined;
      if (congestion?.length) {
        const heavy = congestion.filter(
          (c) => c === "heavy" || c === "severe",
        ).length;
        const ratio = heavy / congestion.length;
        congestionLabel =
          ratio > 0.35
            ? "Heavy traffic"
            : ratio > 0.15
              ? "Moderate traffic"
              : "Clear roads";
      }
      setRoute(primary.geometry);
      setRouteMeta({
        distanceM: primary.distanceM,
        durationS: primary.durationS,
        congestion: congestionLabel,
      });
      setRouteSteps(primary.steps || []);
      setAltRoutes(
        alts.length
          ? {
              type: "FeatureCollection",
              features: alts.map((r, i) => ({
                type: "Feature",
                properties: {
                  index: i + 1,
                  durationS: r.durationS,
                  distanceM: r.distanceM,
                },
                geometry: r.geometry,
              })),
            }
          : null,
      );
    },
    [],
  );

  // Single-destination routing (shop / place)
  useEffect(() => {
    if (!routeDestination || tripStops.length > 0) {
      if (!routeDestination && tripStops.length === 0) {
        setRoute(null);
        setAltRoutes(null);
        setRouteMeta(null);
        setRouteSteps([]);
      }
      return;
    }
    const origin = routeOrigin || resolveOrigin();
    if (!origin) {
      setRoute(null);
      setRouteMeta(null);
      setRouteSteps([]);
      setModeEtas({});
      setAltRoutes(null);
      return;
    }
    let cancelled = false;
    const from = { lng: origin.lng, lat: origin.lat };
    const to = { lng: routeDestination.lng, lat: routeDestination.lat };
    const modes: TravelProfile[] = ["driving-traffic", "walking", "cycling"];

    void Promise.all(
      modes.map(async (profile) => {
        const routes = await fetchDirectionsAll(from, to, profile, {
          alternatives: profile === travel,
        });
        return [profile, routes] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      const nextEtas: Partial<
        Record<TravelProfile, { durationS: number; distanceM: number } | null>
      > = {};
      for (const [profile, routes] of results) {
        const primary = routes[0];
        nextEtas[profile] = primary
          ? { durationS: primary.durationS, distanceM: primary.distanceM }
          : null;
        if (profile === travel) {
          applyRouteResult(primary || null, routes.slice(1));
        }
      }
      setModeEtas(nextEtas);
    });
    return () => {
      cancelled = true;
    };
  }, [
    routeDestination?.id,
    routeDestination?.lat,
    routeDestination?.lng,
    routeOrigin,
    travel,
    resolveOrigin,
    tripStops.length,
    applyRouteResult,
  ]);

  // Multi-stop optimized routing via Mapbox Optimization API
  useEffect(() => {
    if (tripStops.length === 0) return;
    const origin = routeOrigin || resolveOrigin();
    if (!origin) return;

    let cancelled = false;
    const modes: TravelProfile[] = ["driving-traffic", "walking", "cycling"];
    const coords = [
      { lng: origin.lng, lat: origin.lat },
      ...tripStops.map((s) => ({ lng: s.lng, lat: s.lat })),
    ];

    // Open trip: fix start at user, pin farthest stop as end so middle can optimize
    let orderedForApi = tripStops;
    if (tripStops.length >= 2) {
      let farIdx = 0;
      let farD = -1;
      tripStops.forEach((s, i) => {
        const d = distanceKm(origin, { lat: s.lat, lng: s.lng });
        if (d > farD) {
          farD = d;
          farIdx = i;
        }
      });
      const far = tripStops[farIdx];
      orderedForApi = [
        ...tripStops.filter((_, i) => i !== farIdx),
        far,
      ];
    }
    const apiCoords = [
      { lng: origin.lng, lat: origin.lat },
      ...orderedForApi.map((s) => ({ lng: s.lng, lat: s.lat })),
    ];

    setTripBusy(true);
    void Promise.all(
      modes.map(async (profile) => {
        if (tripStops.length === 1) {
          const routes = await fetchDirectionsAll(
            coords[0],
            coords[1],
            profile,
            { alternatives: profile === travel },
          );
          return {
            profile,
            kind: "directions" as const,
            routes,
            order: tripStops.map((s) => s.id),
          };
        }
        const trip = await fetchOptimizedTrip(apiCoords, profile, {
          roundtrip: false,
          source: "first",
          destination: "last",
        });
        return {
          profile,
          kind: "optimized" as const,
          trip,
          apiStops: orderedForApi,
        };
      }),
    ).then((results) => {
      if (cancelled) return;
      const nextEtas: Partial<
        Record<TravelProfile, { durationS: number; distanceM: number } | null>
      > = {};
      for (const result of results) {
        if (result.kind === "directions") {
          const primary = result.routes[0];
          nextEtas[result.profile] = primary
            ? { durationS: primary.durationS, distanceM: primary.distanceM }
            : null;
          if (result.profile === travel) {
            applyRouteResult(primary || null, result.routes.slice(1));
            setOrderedStopIds(tripStops.map((s) => s.id));
          }
        } else {
          const trip = result.trip;
          const apiStops = result.apiStops || tripStops;
          nextEtas[result.profile] = trip
            ? { durationS: trip.durationS, distanceM: trip.distanceM }
            : null;
          if (result.profile === travel && trip) {
            applyRouteResult({
              geometry: trip.geometry,
              distanceM: trip.distanceM,
              durationS: trip.durationS,
              steps: trip.steps,
            });
            // order indices: 0 = origin, 1..n = stops in apiStops
            const stopOrder = trip.waypointOrder
              .filter((idx) => idx > 0)
              .map((idx) => apiStops[idx - 1]?.id)
              .filter(Boolean) as string[];
            if (stopOrder.length === tripStops.length) {
              setOrderedStopIds(stopOrder);
            }
          }
        }
      }
      setModeEtas(nextEtas);
      setTripBusy(false);
      // Fit to route
      requestAnimationFrame(() => {
        const map = mapRef.current;
        if (!map || cancelled) return;
        const b = new mapboxgl.LngLatBounds();
        b.extend([origin.lng, origin.lat]);
        for (const s of tripStops) b.extend([s.lng, s.lat]);
        if (!b.isEmpty()) {
          map.fitBounds(b, {
            padding: { top: 100, bottom: 220, left: 48, right: 80 },
            maxZoom: 15.5,
            duration: 700,
          });
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    tripStops,
    travel,
    routeOrigin,
    resolveOrigin,
    applyRouteResult,
  ]);

  useEffect(() => {
    if (!showIsochrone || !userPoint) {
      setIsochrone(null);
      return;
    }
    let cancelled = false;
    void fetchIsochrone(
      { lng: userPoint.lng, lat: userPoint.lat },
      {
        profile:
          travel === "walking" || travel === "cycling" ? travel : "driving",
        contoursMinutes: [15, isoMinutes].filter(
          (v, i, a) => a.indexOf(v) === i,
        ),
        polygons: true,
      },
    ).then((fc) => {
      if (!cancelled) setIsochrone(fc);
    });
    return () => {
      cancelled = true;
    };
  }, [showIsochrone, userPoint, travel, isoMinutes]);

  useEffect(() => {
    if (!userPoint || filtered.length === 0) {
      setMatrixEtas({});
      return;
    }
    const slice = filtered.slice(0, 24);
    let cancelled = false;
    const t = window.setTimeout(() => {
      void fetchEtasFromOrigin(
        { lng: userPoint.lng, lat: userPoint.lat },
        slice.map((v) => ({ lng: v.lng, lat: v.lat })),
        travel === "walking" || travel === "cycling" ? travel : "driving",
      ).then((etas) => {
        if (cancelled) return;
        const next: Record<
          string,
          { durationS: number | null; distanceM: number | null }
        > = {};
        slice.forEach((v, i) => {
          next[v.id] = etas[i] || { durationS: null, distanceM: null };
        });
        setMatrixEtas(next);
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [userPoint, filtered, travel]);

  useEffect(() => {
    if (fittedOnce.current || loading || filtered.length === 0) return;
    fittedOnce.current = true;
    setFitKey((k) => k + 1);
  }, [loading, filtered.length]);

  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-vendor-id="${selectedId}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const flyTo = useCallback((lng: number, lat: number, zoom = 16) => {
    setCenter([lng, lat]);
    setCameraKey((k) => k + 1);
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom,
      essential: true,
      duration: 850,
    });
  }, []);

  const selectVendor = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSelectedPlace(null);
      setWhatsHere([]);
      setListOpen(false);
      setStepsOpen(false);
      setRouteOrigin(resolveOrigin());
      const v = vendors.find((x) => x.id === id);
      if (v) flyTo(v.lng, v.lat, 16.1);
    },
    [vendors, flyTo, resolveOrigin],
  );

  const selectPlace = useCallback(
    (place: SelectedPlace) => {
      setSelectedId(null);
      setSelectedPlace(place);
      setNearbyMarkers((prev) =>
        prev.map((m) => ({
          ...m,
          active: m.id === place.id,
          pulse: false,
        })),
      );
      setPlaceMarker({
        id: place.id,
        lng: place.lng,
        lat: place.lat,
        kind: "place",
        label: place.name,
        active: true,
        pulse: false,
      });
      setStatusMsg(place.address || place.name);
      setListOpen(false);
      setStepsOpen(false);
      setRouteOrigin(resolveOrigin());
      flyTo(place.lng, place.lat, 16.2);
    },
    [flyTo, resolveOrigin, activeCategory],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setSelectedPlace(null);
    setWhatsHere([]);
    setRoute(null);
    setAltRoutes(null);
    setRouteMeta(null);
    setRouteSteps([]);
    setRouteOrigin(null);
    setMatchedRoute(null);
    setStepsOpen(false);
  }, []);

  const clearPin = useCallback(() => {
    setStatusMsg(null);
    setPlaceMarker(null);
    setSelectedPlace(null);
    setWhatsHere([]);
    setNearbyMarkers([]);
    setPlaceHits([]);
    setActiveCategory(null);
    setMatchedRoute(null);
    setRouteFromPin(false);
    // Keep commerceMarkers — grocery / supermarket stay marked
  }, []);

  const runCategorySearch = useCallback(
    async (categoryId: string) => {
      if (!ALLOWED_CATEGORY_IDS.has(categoryId)) return;
      setActiveCategory(categoryId);
      setSelectedId(null);
      setSelectedPlace(null);
      setPlaceMarker(null);
      setPlaceBusy(true);
      const hits = await searchCategory(categoryId, {
        proximity: userPoint || undefined,
        limit: 25,
      });
      setPlaceBusy(false);
      setPlaceHits(hits);
      const marked = hits
        .filter((h) => h.lng != null && h.lat != null)
        .slice(0, 25)
        .map((h) => ({
          id: h.id,
          lng: h.lng!,
          lat: h.lat!,
          kind: "place" as const,
          label: h.name,
          active: false,
          pulse: false,
        }));
      setNearbyMarkers(marked);
      const label =
        NEARBY_CATEGORIES.find((c) => c.id === categoryId)?.label ||
        categoryId;
      setStatusMsg(
        marked.length
          ? `${marked.length} ${label.toLowerCase()} nearby · tap a pin`
          : `No ${label.toLowerCase()} found nearby`,
      );
      setFitKey((k) => k + 1);

      const map = mapRef.current;
      if (map && marked.length) {
        const b = new mapboxgl.LngLatBounds();
        if (userPoint) b.extend([userPoint.lng, userPoint.lat]);
        for (const m of marked) b.extend([m.lng, m.lat]);
        map.fitBounds(b, {
          padding: { top: 120, bottom: 160, left: 48, right: 72 },
          maxZoom: 15.2,
          duration: 800,
        });
      }
    },
    [userPoint],
  );

  const addStop = useCallback((place: SelectedPlace) => {
    setTripStops((prev) => {
      if (prev.some((s) => s.id === place.id)) return prev;
      if (prev.length >= 11) {
        setStatusMsg("Max 11 stops");
        return prev;
      }
      setStatusMsg(`Added stop · ${place.name}`);
      return [...prev, place];
    });
    setOrderedStopIds([]);
  }, []);

  const removeStop = useCallback((id: string) => {
    setTripStops((prev) => prev.filter((s) => s.id !== id));
    setOrderedStopIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clearTrip = useCallback(() => {
    setTripStops([]);
    setOrderedStopIds([]);
    setTripOpen(false);
    setTripBusy(false);
    setRoute(null);
    setAltRoutes(null);
    setRouteMeta(null);
    setRouteSteps([]);
    setModeEtas({});
  }, []);

  const reoptimizeTrip = useCallback(() => {
    // Force effect re-run by cloning stops array
    setTripStops((prev) => [...prev]);
    setStatusMsg("Finding best route…");
  }, []);

  const snapGpsTrail = useCallback(async () => {
    const trail = gpsTrailRef.current;
    if (trail.length < 2) {
      setStatusMsg("Move a little, then snap again");
      return;
    }
    const matched = await matchTraceToRoads(
      trail,
      travel === "walking" || travel === "cycling" ? travel : "driving",
    );
    if (!matched?.geometry) {
      setStatusMsg("Could not match GPS trail");
      return;
    }
    setMatchedRoute(matched.geometry);
    setStatusMsg(
      `Matched · ${formatDuration(matched.durationS)} · ${formatDistanceKm(matched.distanceM / 1000)}`,
    );
  }, [travel]);

  const pickPlace = async (s: AddressSuggestion) => {
    let lng = s.lng;
    let lat = s.lat;
    let name = s.name;
    let address = s.fullAddress || s.name;
    let featureType = s.featureType || "place";
    if (lng == null || lat == null) {
      if (!s.mapboxId) return;
      const hit = await retrieveAddress(
        s.mapboxId,
        searchSession.current || `kc-${Date.now()}`,
      );
      if (!hit?.lng || !hit?.lat) return;
      lng = hit.lng;
      lat = hit.lat;
      name = hit.name || name;
      address = hit.fullAddress || address;
      featureType = hit.featureType || featureType;
    }
    setPlaceQuery(name);
    setQuery(name);
    setPlaceHits([]);
    setWhatsHere([]);
    selectPlace({
      id: s.id || `place_${lng}_${lat}`,
      lng,
      lat,
      name,
      address,
      featureType,
    });
  };

  const fitToRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !route?.coordinates?.length) return;
    const b = new mapboxgl.LngLatBounds();
    route.coordinates.forEach((c) => b.extend(c as [number, number]));
    map.fitBounds(b, { padding: 100, duration: 700, maxZoom: 16 });
  }, [route]);

  const copyCoords = useCallback(async () => {
    const point =
      placeMarker ||
      (selected
        ? { lng: selected.lng, lat: selected.lat }
        : userPoint
          ? { lng: userPoint.lng, lat: userPoint.lat }
          : null);
    if (!point) return;
    const text = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setStatusMsg(`Copied ${text}`);
    } catch {
      setStatusMsg(text);
    }
  }, [placeMarker, selected, userPoint]);

  const altRoutesGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
    const features: GeoJSON.Feature[] = [];
    if (showAlts && altRoutes?.features?.length) {
      features.push(...altRoutes.features);
    }
    if (matchedRoute) {
      features.push({
        type: "Feature",
        properties: { kind: "matched" },
        geometry: matchedRoute,
      });
    }
    return features.length
      ? { type: "FeatureCollection", features }
      : null;
  }, [altRoutes, matchedRoute, showAlts]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 280 });
  };

  const tokenMissing = !getMapboxToken();

  const activePoint = selected
    ? { lng: selected.lng, lat: selected.lat, label: selected.name }
    : placeMarker
      ? {
          lng: placeMarker.lng,
          lat: placeMarker.lat,
          label: placeMarker.label || "Pin",
        }
      : userPoint
        ? { lng: userPoint.lng, lat: userPoint.lat, label: "You" }
        : null;

  const streetViewSrc = selected
    ? googleStreetViewEmbedUrl({
        lat: selected.lat,
        lng: selected.lng,
        label: selected.name,
      })
    : selectedPlace
      ? googleStreetViewEmbedUrl({
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
          label: selectedPlace.name,
        })
      : null;


  return (
    <div className="relative h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[var(--kc-canvas)] lg:h-[calc(100dvh-4rem)]">
      {tokenMissing ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-[15px] text-black/45">
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the map.
        </div>
      ) : (
        <>
          <MapCanvas
            className="absolute inset-0 h-full w-full"
            mapStyle={preset.url}
            flat={mapFlat}
            freeCamera={mapFree}
            center={center}
            zoom={MAP_FLAT_ZOOM}
            pitch={mapPitch}
            bearing={mapBearing}
            markers={markers}
            vendorGeoJSON={vendorGeoJSON}
            routeGeoJSON={route}
            altRoutesGeoJSON={altRoutesGeoJSON}
            isochroneGeoJSON={isochrone}
            fitRoute={false}
            fitMarkers={
              fitKey > 0 &&
              !selected &&
              !selectedPlace &&
              !activeCategory &&
              tripStops.length === 0
            }
            interactive
            showNavControls={false}
            showTraffic={showTraffic}
            followUser={false}
            userLngLat={userPoint ? [userPoint.lng, userPoint.lat] : null}
            cameraKey={`${cameraKey}-${povCameraKey}`}
            onVendorClick={selectVendor}
            onMarkerClick={(id) => {
              const stopId = id.startsWith("stop_") ? id.slice(5) : id;
              const tripHit = tripStops.find((s) => s.id === stopId);
              if (tripHit) {
                selectPlace(tripHit);
                return;
              }
              const hit =
                placeHits.find((p) => p.id === id) ||
                commerceHits.find((p) => p.id === id);
              if (hit) {
                void pickPlace(hit);
                return;
              }
              const m =
                nearbyMarkers.find((x) => x.id === id) ||
                commerceMarkers.find((x) => x.id === id);
              if (m) {
                const fromHit =
                  placeHits.find((p) => p.id === m.id) ||
                  commerceHits.find((p) => p.id === m.id);
                selectPlace({
                  id: m.id,
                  lng: m.lng,
                  lat: m.lat,
                  name: fromHit?.name || m.label || "Place",
                  address: fromHit?.fullAddress || m.label || "Place",
                  featureType:
                    fromHit?.featureType || activeCategory || "shop",
                });
              }
            }}
            onMapClick={(ll) => {
              setListOpen(false);
              void (async () => {
                const [primary, many] = await Promise.all([
                  searchBoxReverse(ll.lng, ll.lat),
                  searchBoxReverseMany(ll.lng, ll.lat, { limit: 6 }),
                ]);
                setWhatsHere(many);
                const name =
                  primary?.name ||
                  `Pin · ${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
                const address =
                  primary?.fullAddress ||
                  `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
                selectPlace({
                  id: primary?.id || `pin_${ll.lng}_${ll.lat}`,
                  lng: ll.lng,
                  lat: ll.lat,
                  name,
                  address,
                  featureType: primary?.featureType || "address",
                });
              })();
            }}
            onReady={(map) => {
              mapRef.current = map;
            }}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-black/10 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black/10 via-transparent to-transparent" />

          {/* Top search */}
          <div className="absolute left-4 top-4 z-30 w-[min(100%-2rem,28rem)] sm:left-6 sm:top-5 sm:w-[min(100%-3rem,32rem)]">
            <div className={cn("overflow-visible", frost)}>
              <div className="px-1.5">
                <AdvancedMapSearch
                  value={placeQuery}
                  map={mapRef.current}
                  proximity={userPoint}
                  vendors={filtered}
                  placeholder="Search places, streets, shops…"
                  onChange={(v) => {
                    setPlaceQuery(v);
                    setQuery(v);
                    setListOpen(false);
                  }}
                  onClear={() => {
                    setPlaceQuery("");
                    setQuery("");
                    setPlaceHits([]);
                    setNearbyMarkers([]);
                    setActiveCategory(null);
                    setStatusMsg(null);
                    clearPin();
                    clearSelection();
                  }}
                  onPlaceSelect={(place) => {
                    selectPlace(place);
                    setPlaceQuery(place.name);
                    setQuery(place.name);
                  }}
                  onVendorSelect={(id) => selectVendor(id)}
                  onCategorySelect={(id) => {
                    if (!ALLOWED_CATEGORY_IDS.has(id)) return;
                    void runCategorySearch(id);
                  }}
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
            </div>

            {statusMsg ? (
              <p
                className={cn(
                  "mt-2 truncate px-3 py-2 text-[12px] text-black/50",
                  frost,
                )}
              >
                {statusMsg}
              </p>
            ) : null}

            {placeBusy ? (
              <p
                className={cn(
                  "mt-2 px-3 py-2 text-[12px] text-black/40",
                  frost,
                )}
              >
                Finding nearby…
              </p>
            ) : null}

            {!placeBusy && placeHits.length > 0 && activeCategory ? (
              <div
                className={cn(
                  "scrollbar-hide mt-2 max-h-[32vh] overflow-y-auto",
                  frost,
                )}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-black/40">
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
                  {placeHits.slice(0, 10).map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => void pickPlace(s)}
                        className="flex w-full items-start justify-between gap-3 border-t border-black/[0.05] px-4 py-3 text-left hover:bg-white/40"
                      >
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium text-black">
                            {s.name}
                          </span>
                          <span className="mt-1 block truncate text-[12px] text-black/45">
                            {s.fullAddress}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-black/35">
                          {featureTypeLabel(s.featureType)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {/* Controls — bottom right, icons only */}
          <div className="absolute bottom-4 right-3 z-40 sm:bottom-6 sm:right-5">
            <MapChrome
              styleId={styleId}
              onStyleChange={setStyleId}
              povId={povId}
              onPovChange={applyPov}
              compact
              collapsible
              listOpen={listOpen}
              onListToggle={() => setListOpen((v) => !v)}
              onZoomIn={() => zoomBy(1)}
              onZoomOut={() => zoomBy(-1)}
              onRecenter={() => {
                track();
                if (userPoint) flyTo(userPoint.lng, userPoint.lat, 15.6);
                else flyTo(NAIROBI_CENTER[0], NAIROBI_CENTER[1], 13);
              }}
            />
          </div>

          {/* Bottom-left cards */}
          <div className="absolute bottom-4 left-3 z-30 w-[min(100%-5.5rem,22rem)] sm:bottom-6 sm:left-5 sm:w-[min(100%-7rem,24rem)]">
            <div className="flex flex-col gap-3">
              {/* List */}
              {listOpen ? (
                <div
                  className={cn(
                    "flex max-h-[48vh] flex-col overflow-hidden",
                    frost,
                  )}
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-black/35">
                        Shops
                      </p>
                      <p className="mt-1 text-[16px] font-medium text-black">
                        {filtered.length} nearby
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          ["nearest", "Nearest"],
                          ["fastest", "Prep"],
                          ["rating", "Rating"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSort(id)}
                          className={cn(
                            "h-8 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                            sort === id
                              ? "bg-black text-white"
                              : "text-black/35",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setListOpen(false)}
                        className="ml-1 text-black/35 hover:text-black"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={listRef}
                    className="scrollbar-hide min-h-0 flex-1 overflow-y-auto"
                  >
                    {filtered.map((v) => {
                      const matrix = matrixEtas[v.id];
                      const dist =
                        matrix?.distanceM != null
                          ? matrix.distanceM / 1000
                          : userPoint
                            ? distanceKm(userPoint, {
                                lat: v.lat,
                                lng: v.lng,
                              })
                            : null;
                      const driveEta =
                        matrix?.durationS != null
                          ? formatDuration(matrix.durationS)
                          : null;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          data-vendor-id={v.id}
                          onMouseEnter={() => setHoveredId(v.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => selectVendor(v.id)}
                          className={cn(
                            "flex w-full items-start justify-between gap-4 border-t border-black/[0.05] px-5 py-3.5 text-left hover:bg-black/[0.02]",
                            selectedId === v.id && "bg-black/[0.03]",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-medium text-black">
                              {v.name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-black/40">
                              <span
                                className={
                                  v.openNow ? "text-[#248a3d]" : undefined
                                }
                              >
                                {v.openNow ? "Open" : "Closed"}
                              </span>
                              {v.primaryCategory
                                ? ` · ${v.primaryCategory}`
                                : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-[12px] tabular-nums text-black/45">
                            {driveEta ||
                              (dist != null ? formatDistanceKm(dist) : "")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Place details — top right (portal) */}
              {selected && !listOpen ? (
                <PlaceSheet
                  place={{
                    id: selected.id,
                    lng: selected.lng,
                    lat: selected.lat,
                    name: selected.name,
                    address: selected.address || selected.neighbourhood,
                    slug: selected.slug,
                    openNow: selected.openNow,
                    pickupMinutes: selected.pickupMinutes,
                    deliveryMinutes: selected.deliveryMinutes,
                    rating: selected.rating,
                    reviewCount: selected.reviewCount,
                    hoursLabel: selected.hoursLabel,
                    primaryCategory: selected.primaryCategory,
                    isVendor: true,
                  }}
                  distanceKm={selectedDist}
                  congestion={routeMeta?.congestion}
                  streetViewSrc={streetViewSrc}
                  tripCount={tripStops.length}
                  onClose={clearSelection}
                  onFlyHere={() => flyTo(selected.lng, selected.lat, 16.2)}
                  onStreetView={() =>
                    openExternalMaps(
                      {
                        lng: selected.lng,
                        lat: selected.lat,
                        label: selected.name,
                      },
                      "streetview",
                    )
                  }
                  onOpenMaps={() =>
                    openExternalMaps(
                      {
                        lng: selected.lng,
                        lat: selected.lat,
                        label: selected.name,
                      },
                      "place",
                    )
                  }
                  onCopy={() => void copyCoords()}
                  onShare={() => {
                    const url =
                      "https://www.google.com/maps?q=" +
                      selected.lat +
                      "," +
                      selected.lng;
                    void navigator.clipboard
                      ?.writeText(url)
                      .then(() => setStatusMsg("Share link copied"))
                      .catch(() =>
                        openExternalMaps(
                          {
                            lng: selected.lng,
                            lat: selected.lat,
                            label: selected.name,
                          },
                          "share",
                        ),
                      );
                  }}
                />
              ) : null}

              {selectedPlace && !selected && !listOpen ? (
                <PlaceSheet
                  place={{
                    id: selectedPlace.id,
                    lng: selectedPlace.lng,
                    lat: selectedPlace.lat,
                    name: selectedPlace.name,
                    address: selectedPlace.address,
                    featureType: selectedPlace.featureType,
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
                    clearSelection();
                    setPlaceMarker(null);
                    if (!activeCategory) {
                      setNearbyMarkers([]);
                      setPlaceHits([]);
                    }
                  }}
                  onFlyHere={() =>
                    flyTo(selectedPlace.lng, selectedPlace.lat, 16.2)
                  }
                  onStreetView={() =>
                    openExternalMaps(
                      {
                        lng: selectedPlace.lng,
                        lat: selectedPlace.lat,
                        label: selectedPlace.name,
                      },
                      "streetview",
                    )
                  }
                  onOpenMaps={() =>
                    openExternalMaps(
                      {
                        lng: selectedPlace.lng,
                        lat: selectedPlace.lat,
                        label: selectedPlace.name,
                      },
                      "place",
                    )
                  }
                  onCopy={() => void copyCoords()}
                  onShare={() => {
                    const url =
                      "https://www.google.com/maps?q=" +
                      selectedPlace.lat +
                      "," +
                      selectedPlace.lng;
                    void navigator.clipboard
                      ?.writeText(url)
                      .then(() => setStatusMsg("Share link copied"))
                      .catch(() =>
                        openExternalMaps(
                          {
                            lng: selectedPlace.lng,
                            lat: selectedPlace.lat,
                            label: selectedPlace.name,
                          },
                          "share",
                        ),
                      );
                  }}
                  onPickRelated={(id) => {
                    const w = whatsHere.find((x) => x.id === id);
                    if (w) void pickPlace(w);
                  }}
                />
              ) : null}

              {/* Routing / stops — bottom left (portal) */}
              {!listOpen &&
              (selected || selectedPlace || tripStops.length > 0) ? (
                <RoutePanel
                  travel={travel}
                  modeEtas={modeEtas}
                  stepsOpen={stepsOpen}
                  routeSteps={routeSteps}
                  inTrip={
                    selected
                      ? tripStops.some((s) => s.id === selected.id)
                      : selectedPlace
                        ? tripStops.some((s) => s.id === selectedPlace.id)
                        : false
                  }
                  tripStops={tripStops}
                  orderedIds={orderedStopIds}
                  tripOpen={tripOpen}
                  totalMeta={routeMeta}
                  optimizing={tripBusy}
                  hasDestination={Boolean(selected || selectedPlace)}
                  onTravelChange={setTravel}
                  onNavigate={() => {
                    const dest = selected || selectedPlace;
                    if (!dest) return;
                    openExternalMaps(
                      {
                        lng: dest.lng,
                        lat: dest.lat,
                        label: dest.name,
                      },
                      "directions",
                      userPoint,
                      {
                        travelMode:
                          travel === "walking"
                            ? "walking"
                            : travel === "cycling"
                              ? "bicycling"
                              : "driving",
                      },
                    );
                  }}
                  onToggleSteps={() => setStepsOpen((v) => !v)}
                  onAddStop={() => {
                    if (selected) {
                      addStop({
                        id: selected.id,
                        lng: selected.lng,
                        lat: selected.lat,
                        name: selected.name,
                        address: selected.address || selected.neighbourhood,
                        featureType: "shop",
                      });
                      setTripOpen(true);
                    } else if (selectedPlace) {
                      addStop(selectedPlace);
                      setTripOpen(true);
                    }
                  }}
                  onRemoveStop={() => {
                    if (selected) removeStop(selected.id);
                    else if (selectedPlace) removeStop(selectedPlace.id);
                  }}
                  onOpenTrip={() => setTripOpen(true)}
                  onCloseTrip={() => setTripOpen(false)}
                  onRemoveTripStop={removeStop}
                  onSelectTripStop={(id) => {
                    const s = tripStops.find((x) => x.id === id);
                    if (s) selectPlace(s);
                  }}
                  onClearTrip={clearTrip}
                  onOptimize={reoptimizeTrip}
                />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
