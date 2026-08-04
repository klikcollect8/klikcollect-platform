"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  DEFAULT_MAP_ZOOM,
  getMapboxToken,
  MAP_BEARING,
  MAP_PITCH,
  MAPBOX_STYLE,
  NAIROBI_CENTER,
} from "@/lib/mapbox";

export type MapMarker = {
  id: string;
  lng: number;
  lat: number;
  label?: string;
  kind?: "vendor" | "user" | "pickup" | "place";
  active?: boolean;
};

type MapCanvasProps = {
  className?: string;
  style?: CSSProperties;
  mapStyle?: string;
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  markers?: MapMarker[];
  /** Clustered commerce vendors (GeoJSON) */
  vendorGeoJSON?: GeoJSON.FeatureCollection | null;
  routeGeoJSON?: GeoJSON.LineString | null;
  interactive?: boolean;
  showNavControls?: boolean;
  minimalControls?: boolean;
  followUser?: boolean;
  userLngLat?: [number, number] | null;
  fitMarkers?: boolean;
  fitRoute?: boolean;
  alwaysShowLabels?: boolean;
  /** Flat 2D streets (no terrain / tilt) - product pickup style */
  flat?: boolean;
  cameraKey?: string | number | null;
  onMarkerClick?: (id: string) => void;
  onVendorClick?: (id: string) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onReady?: (map: mapboxgl.Map) => void;
};

const ROUTE_SOURCE = "kc-route";
const ROUTE_LAYER = "kc-route-line";
const ROUTE_CASING = "kc-route-casing";
const VENDOR_SOURCE = "kc-vendors";
const CLUSTER_LAYER = "kc-clusters";
const CLUSTER_COUNT = "kc-cluster-count";
const VENDOR_LAYER = "kc-vendor-points";
const VENDOR_LABEL = "kc-vendor-labels";

function markerClass(kind: MapMarker["kind"], active?: boolean) {
  if (kind === "user") return "kc-map-marker kc-map-marker--user";
  if (kind === "place") return "kc-map-marker kc-map-marker--place";
  if (active) return "kc-map-marker kc-map-marker--active";
  return "kc-map-marker";
}

function enable3D(map: mapboxgl.Map) {
  try {
    if (!map.getSource("mapbox-dem")) {
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
  } catch {
    /* ok */
  }
  try {
    if (!map.getLayer("sky")) {
      map.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0.0, 80.0],
          "sky-atmosphere-sun-intensity": 12,
        },
      });
    }
  } catch {
    /* ok */
  }
}

function ensureRouteLayers(map: mapboxgl.Map) {
  if (!map.getSource(ROUTE_SOURCE)) {
    map.addSource(ROUTE_SOURCE, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      },
    });
  }
  if (!map.getLayer(ROUTE_CASING)) {
    map.addLayer({
      id: ROUTE_CASING,
      type: "line",
      source: ROUTE_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": 8,
        "line-opacity": 0.9,
      },
    });
  }
  if (!map.getLayer(ROUTE_LAYER)) {
    map.addLayer({
      id: ROUTE_LAYER,
      type: "line",
      source: ROUTE_SOURCE,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#2f6b4f",
        "line-width": 4.5,
        "line-opacity": 0.95,
      },
    });
  }
}

function ensureVendorLayers(map: mapboxgl.Map) {
  if (!map.getSource(VENDOR_SOURCE)) {
    map.addSource(VENDOR_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 48,
    });
  }

  if (!map.getLayer(CLUSTER_LAYER)) {
    map.addLayer({
      id: CLUSTER_LAYER,
      type: "circle",
      source: VENDOR_SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#2f6b4f",
        "circle-radius": ["step", ["get", "point_count"], 16, 4, 20, 8, 26],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#f7f7f5",
        "circle-opacity": 0.92,
      },
    });
  }

  if (!map.getLayer(CLUSTER_COUNT)) {
    map.addLayer({
      id: CLUSTER_COUNT,
      type: "symbol",
      source: VENDOR_SOURCE,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    });
  }

  if (!map.getLayer(VENDOR_LAYER)) {
    map.addLayer({
      id: VENDOR_LAYER,
      type: "circle",
      source: VENDOR_SOURCE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "case",
          ["boolean", ["get", "active"], false],
          "#1b4332",
          ["get", "colour"],
        ],
        "circle-radius": [
          "case",
          ["boolean", ["get", "active"], false],
          11,
          ["boolean", ["get", "highlighted"], true],
          8,
          5,
        ],
        "circle-stroke-width": [
          "case",
          ["boolean", ["get", "active"], false],
          3,
          2,
        ],
        "circle-stroke-color": "#f7f7f5",
        "circle-opacity": [
          "case",
          ["boolean", ["get", "dimmed"], false],
          0.25,
          0.95,
        ],
      },
    });
  }

  if (!map.getLayer(VENDOR_LABEL)) {
    map.addLayer({
      id: VENDOR_LABEL,
      type: "symbol",
      source: VENDOR_SOURCE,
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        [
          "any",
          ["==", ["get", "highlighted"], true],
          ["==", ["get", "active"], true],
        ],
      ],
      minzoom: 13.5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": 11,
        "text-offset": [0, 1.35],
        "text-anchor": "top",
        "text-max-width": 10,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#1a1a1a",
        "text-halo-color": "rgba(247,247,245,0.92)",
        "text-halo-width": 1.4,
        "text-opacity": [
          "case",
          ["boolean", ["get", "dimmed"], false],
          0.2,
          0.9,
        ],
      },
    });
  }
}

function setRouteData(
  map: mapboxgl.Map,
  routeGeoJSON: GeoJSON.LineString | null | undefined,
) {
  ensureRouteLayers(map);
  const source = map.getSource(ROUTE_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  if (!source) return;
  source.setData({
    type: "Feature",
    properties: {},
    geometry: routeGeoJSON || { type: "LineString", coordinates: [] },
  });
}

function setVendorData(
  map: mapboxgl.Map,
  data: GeoJSON.FeatureCollection | null | undefined,
) {
  ensureVendorLayers(map);
  const source = map.getSource(VENDOR_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  if (!source) return;
  source.setData(data || { type: "FeatureCollection", features: [] });
}

export default function MapCanvas({
  className,
  style,
  mapStyle = MAPBOX_STYLE,
  center = NAIROBI_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  pitch = MAP_PITCH,
  bearing = MAP_BEARING,
  markers = [],
  vendorGeoJSON = null,
  routeGeoJSON = null,
  interactive = true,
  showNavControls = false,
  minimalControls = false,
  followUser = false,
  userLngLat = null,
  fitMarkers = false,
  fitRoute = false,
  alwaysShowLabels = true,
  flat = false,
  cameraKey = null,
  onMarkerClick,
  onVendorClick,
  onMapClick,
  onReady,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onVendorClickRef = useRef(onVendorClick);
  const onMapClickRef = useRef(onMapClick);
  const onReadyRef = useRef(onReady);
  const followUserRef = useRef(followUser);
  const hasCenteredOnUserRef = useRef(false);
  const lastCameraKeyRef = useRef<string | number | null>(null);
  const routeRef = useRef(routeGeoJSON);
  const vendorsRef = useRef(vendorGeoJSON);
  const styleRef = useRef(mapStyle);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);
  useEffect(() => {
    onVendorClickRef.current = onVendorClick;
  }, [onVendorClick]);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    followUserRef.current = followUser;
  }, [followUser]);
  useEffect(() => {
    routeRef.current = routeGeoJSON;
  }, [routeGeoJSON]);
  useEffect(() => {
    vendorsRef.current = vendorGeoJSON;
  }, [vendorGeoJSON]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = getMapboxToken();
    if (!token) return;

    mapboxgl.accessToken = token;
    styleRef.current = mapStyle;

    const initialPitch = flat ? 0 : pitch;
    const initialBearing = flat ? 0 : bearing;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center,
      zoom,
      pitch: initialPitch,
      bearing: initialBearing,
      accessToken: token,
      interactive,
      attributionControl: true,
      logoPosition: "bottom-right",
      antialias: true,
      doubleClickZoom: interactive,
      dragRotate: interactive && !flat,
      touchPitch: interactive && !flat,
      pitchWithRotate: interactive && !flat,
      fadeDuration: 200,
      maxPitch: flat ? 0 : 85,
    });

    map.on("error", (e) => console.error("[mapbox]", e.error || e));

    if (showNavControls && interactive) {
      map.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
          showCompass: true,
          showZoom: true,
        }),
        "bottom-right",
      );
      if (!minimalControls) {
        map.addControl(new mapboxgl.FullscreenControl(), "bottom-right");
        map.addControl(
          new mapboxgl.ScaleControl({ maxWidth: 100, unit: "metric" }),
          "bottom-left",
        );
      }
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
        showAccuracyCircle: true,
      });
      geolocateRef.current = geolocate;
      map.addControl(geolocate, "bottom-right");
      map.on("load", () => {
        try {
          geolocate.trigger();
        } catch {
          /* ok */
        }
      });
    }

    map.on("click", (e) => {
      const layers = [VENDOR_LAYER, CLUSTER_LAYER].filter((id) =>
        map.getLayer(id),
      );
      if (layers.length) {
        const feats = map.queryRenderedFeatures(e.point, { layers });
        if (feats.length) {
          const f = feats[0];
          if (f.layer?.id === CLUSTER_LAYER && f.geometry.type === "Point") {
            const clusterId = f.properties?.cluster_id;
            const source = map.getSource(
              VENDOR_SOURCE,
            ) as mapboxgl.GeoJSONSource;
            source.getClusterExpansionZoom(clusterId, (err, zoomOut) => {
              if (err || zoomOut == null) return;
              const coords = (f.geometry as GeoJSON.Point).coordinates as [
                number,
                number,
              ];
              map.easeTo({
                center: coords,
                zoom: zoomOut,
                pitch: MAP_PITCH,
                bearing: MAP_BEARING,
                duration: 500,
              });
            });
            return;
          }
          if (f.layer?.id === VENDOR_LAYER && f.properties?.id) {
            onVendorClickRef.current?.(String(f.properties.id));
            return;
          }
        }
      }
      onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    map.on("mouseenter", VENDOR_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", VENDOR_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", CLUSTER_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", CLUSTER_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });

    const onStyleReady = () => {
      if (!flat) enable3D(map);
      else {
        try {
          map.setTerrain(null);
        } catch {
          /* ok */
        }
      }
      setRouteData(map, routeRef.current);
      setVendorData(map, vendorsRef.current);
    };

    map.on("style.load", onStyleReady);
    map.on("load", () => {
      onStyleReady();
      requestAnimationFrame(() => {
        map.resize();
        onReadyRef.current?.(map);
      });
    });

    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      geolocateRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapStyle || mapStyle === styleRef.current) return;
    styleRef.current = mapStyle;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const m of markers) {
      /* Vendor clusters come from GeoJSON - skip those only */
      if (m.kind === "vendor") continue;

      const el = document.createElement("button");
      el.type = "button";
      el.className = markerClass(m.kind, m.active);
      el.setAttribute("aria-label", m.label || m.id);
      if (m.kind === "user") {
        const pulse = document.createElement("span");
        pulse.className = "kc-map-marker__pulse";
        el.appendChild(pulse);
        const you = document.createElement("span");
        you.className = "kc-map-marker__label kc-map-marker__label--always";
        you.textContent = "You";
        el.appendChild(you);
      } else if (m.label && alwaysShowLabels) {
        const tip = document.createElement("span");
        tip.className = "kc-map-marker__label kc-map-marker__label--always";
        tip.textContent = m.label;
        el.appendChild(tip);
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onMarkerClickRef.current?.(m.id);
      });
      markersRef.current.push(
        new mapboxgl.Marker({
          element: el,
          anchor: m.kind === "user" ? "center" : "bottom",
        })
          .setLngLat([m.lng, m.lat])
          .addTo(map),
      );
    }
  }, [markers, alwaysShowLabels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => setVendorData(map, vendorGeoJSON);
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [vendorGeoJSON]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      setRouteData(map, routeGeoJSON);
      if (fitRoute && routeGeoJSON && routeGeoJSON.coordinates.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        routeGeoJSON.coordinates.forEach((c) =>
          bounds.extend(c as [number, number]),
        );
        map.fitBounds(bounds, {
          padding: { top: 120, bottom: 220, left: 48, right: 48 },
          maxZoom: 16.5,
          pitch: MAP_PITCH,
          bearing: MAP_BEARING,
          duration: 800,
        });
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [routeGeoJSON, fitRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLngLat || !followUser) return;
    const [lng, lat] = userLngLat;
    if (!hasCenteredOnUserRef.current) {
      hasCenteredOnUserRef.current = true;
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(zoom, 15.8),
        pitch,
        bearing: MAP_BEARING,
        essential: true,
        duration: 1200,
      });
      return;
    }
    map.easeTo({ center: [lng, lat], duration: 500 });
  }, [userLngLat, followUser, zoom, pitch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitMarkers || followUser || fitRoute) return;
    if (cameraKey != null && cameraKey === lastCameraKeyRef.current) return;
    if (cameraKey != null) lastCameraKeyRef.current = cameraKey;
    map.flyTo({
      center,
      zoom,
      pitch,
      bearing,
      essential: true,
      duration: 1000,
    });
  }, [
    center,
    zoom,
    pitch,
    bearing,
    fitMarkers,
    followUser,
    fitRoute,
    cameraKey,
  ]);

  const token = getMapboxToken();
  if (!token) {
    return (
      <div className={className} style={style} role="status">
        <div className="flex h-full min-h-[160px] items-center justify-center bg-black/[0.03] text-[13px] text-black/45">
          Map unavailable - set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} style={style} />;
}
