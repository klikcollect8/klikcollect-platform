"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
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
  kind?: "vendor" | "user" | "pickup" | "place" | "driver" | "dropoff" | "stop";
  active?: boolean;
  /** Expanding ring animation (category POIs, GPS, etc.) */
  pulse?: boolean;
  /** 1-based stop index for multi-stop trips */
  stopIndex?: number;
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
  /** Alternative route geometries (Directions alternatives) */
  altRoutesGeoJSON?: GeoJSON.FeatureCollection | null;
  /** Reachable-area polygons (Isochrone) */
  isochroneGeoJSON?: GeoJSON.FeatureCollection | null;
  interactive?: boolean;
  showNavControls?: boolean;
  minimalControls?: boolean;
  followUser?: boolean;
  userLngLat?: [number, number] | null;
  /** Pass a number key to fit once per key; boolean still supported */
  fitMarkers?: boolean | number;
  fitRoute?: boolean;
  alwaysShowLabels?: boolean;
  /** Flat 2D streets (no terrain / tilt) - product pickup style */
  flat?: boolean;
  /** Allow free tilt / rotate (interactive POV) */
  freeCamera?: boolean;
  /** Live traffic congestion overlay (Mapbox Traffic v1) */
  showTraffic?: boolean;
  cameraKey?: string | number | null;
  onMarkerClick?: (id: string) => void;
  onVendorClick?: (id: string) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onReady?: (map: mapboxgl.Map) => void;
};

const ROUTE_SOURCE = "kc-route";
const ROUTE_LAYER = "kc-route-line";
const ROUTE_CASING = "kc-route-casing";
const ALT_ROUTE_SOURCE = "kc-alt-routes";
const ALT_ROUTE_LAYER = "kc-alt-route-line";
const ISOCHRONE_SOURCE = "kc-isochrone";
const ISOCHRONE_FILL = "kc-isochrone-fill";
const ISOCHRONE_LINE = "kc-isochrone-line";
const VENDOR_SOURCE = "kc-vendors";
const CLUSTER_LAYER = "kc-clusters";
const CLUSTER_COUNT = "kc-cluster-count";
const VENDOR_LAYER = "kc-vendor-points";
const VENDOR_LABEL = "kc-vendor-labels";
const TRAFFIC_SOURCE = "kc-traffic";
const TRAFFIC_LAYER = "kc-traffic-line";

function setTrafficVisible(map: mapboxgl.Map, visible: boolean) {
  try {
    if (visible) {
      if (!map.getSource(TRAFFIC_SOURCE)) {
        map.addSource(TRAFFIC_SOURCE, {
          type: "vector",
          url: "mapbox://mapbox.mapbox-traffic-v1",
        });
      }
      if (!map.getLayer(TRAFFIC_LAYER)) {
        map.addLayer({
          id: TRAFFIC_LAYER,
          type: "line",
          source: TRAFFIC_SOURCE,
          "source-layer": "traffic",
          paint: {
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10,
              1.2,
              16,
              3.5,
            ],
            "line-color": [
              "match",
              ["get", "congestion"],
              "low",
              "#4ade80",
              "moderate",
              "#facc15",
              "heavy",
              "#fb923c",
              "severe",
              "#ef4444",
              "#94a3b8",
            ],
            "line-opacity": 0.85,
          },
        });
      } else {
        map.setLayoutProperty(TRAFFIC_LAYER, "visibility", "visible");
      }
    } else if (map.getLayer(TRAFFIC_LAYER)) {
      map.setLayoutProperty(TRAFFIC_LAYER, "visibility", "none");
    }
  } catch {
    /* style may not support vector traffic */
  }
}

function markerClass(kind: MapMarker["kind"], active?: boolean) {
  if (kind === "user" || kind === "driver")
    return "kc-map-marker kc-map-marker--user";
  if (kind === "stop") return "kc-map-marker kc-map-marker--stop";
  if (kind === "place")
    return active
      ? "kc-map-marker kc-map-marker--place kc-map-marker--active"
      : "kc-map-marker kc-map-marker--place";
  if (kind === "dropoff") return "kc-map-marker kc-map-marker--dropoff";
  if (active) return "kc-map-marker kc-map-marker--place kc-map-marker--active";
  return "kc-map-marker kc-map-marker--place";
}

/** Raster teardrop pin for Mapbox symbol layers (vendors) */
function createGooglePinImage(color: string, size = 64): ImageData {
  const w = size;
  const h = Math.round(size * 1.3);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(w, h);

  const cx = w / 2;
  const tipY = h - 4;
  const headY = h * 0.38;
  const r = w * 0.3;

  // Soft ground shadow
  ctx.beginPath();
  ctx.ellipse(cx, tipY, w * 0.14, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();

  // Pin outline (circle head + pointed tip)
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.quadraticCurveTo(cx + r * 1.15, headY + r * 0.35, cx + r, headY);
  ctx.arc(cx, headY, r, 0.15, Math.PI - 0.15, true);
  ctx.quadraticCurveTo(cx - r * 1.15, headY + r * 0.35, cx, tipY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // White center eye
  ctx.beginPath();
  ctx.arc(cx, headY, r * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  return ctx.getImageData(0, 0, w, h);
}

function ensureGooglePinImages(map: mapboxgl.Map) {
  const pins: Array<[string, string]> = [
    ["kc-pin-vendor", "#ea4335"],
    ["kc-pin-vendor-active", "#188038"],
    ["kc-pin-vendor-green", "#34a853"],
  ];
  for (const [id, color] of pins) {
    if (!map.hasImage(id)) {
      try {
        map.addImage(id, createGooglePinImage(color), { pixelRatio: 2 });
      } catch {
        /* image may race on style reload */
      }
    }
  }
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
  ensureGooglePinImages(map);

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
        "circle-color": "#1a73e8",
        "circle-radius": ["step", ["get", "point_count"], 16, 4, 20, 8, 26],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.95,
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

  // Replace legacy circle vendor points with Google-style pin symbols
  if (map.getLayer(VENDOR_LAYER)) {
    const existing = map.getLayer(VENDOR_LAYER);
    if (existing && existing.type === "circle") {
      map.removeLayer(VENDOR_LAYER);
    }
  }

  if (!map.getLayer(VENDOR_LAYER)) {
    map.addLayer({
      id: VENDOR_LAYER,
      type: "symbol",
      source: VENDOR_SOURCE,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": [
          "case",
          ["boolean", ["get", "active"], false],
          "kc-pin-vendor-active",
          "kc-pin-vendor-green",
        ],
        "icon-size": [
          "case",
          ["boolean", ["get", "active"], false],
          0.55,
          ["boolean", ["get", "hovered"], false],
          0.5,
          0.42,
        ],
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": [
          "case",
          ["boolean", ["get", "dimmed"], false],
          0.35,
          1,
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

function ensureAltRouteLayers(map: mapboxgl.Map) {
  if (!map.getSource(ALT_ROUTE_SOURCE)) {
    map.addSource(ALT_ROUTE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(ALT_ROUTE_LAYER)) {
    map.addLayer(
      {
        id: ALT_ROUTE_LAYER,
        type: "line",
        source: ALT_ROUTE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#94a3b8",
          "line-width": 3.5,
          "line-opacity": 0.55,
          "line-dasharray": [1.2, 1.6],
        },
      },
      map.getLayer(ROUTE_CASING) ? ROUTE_CASING : undefined,
    );
  }
}

function setAltRouteData(
  map: mapboxgl.Map,
  data: GeoJSON.FeatureCollection | null | undefined,
) {
  ensureAltRouteLayers(map);
  const source = map.getSource(ALT_ROUTE_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  source?.setData(data || { type: "FeatureCollection", features: [] });
}

function ensureIsochroneLayers(map: mapboxgl.Map) {
  if (!map.getSource(ISOCHRONE_SOURCE)) {
    map.addSource(ISOCHRONE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (!map.getLayer(ISOCHRONE_FILL)) {
    map.addLayer(
      {
        id: ISOCHRONE_FILL,
        type: "fill",
        source: ISOCHRONE_SOURCE,
        paint: {
          "fill-color": [
            "match",
            ["to-number", ["get", "contour"]],
            10,
            "#2f6b4f",
            15,
            "#3d8b63",
            20,
            "#5a9e7a",
            30,
            "#8fbc8f",
            "#a8d4b0",
          ],
          "fill-opacity": 0.18,
        },
      },
      map.getLayer(CLUSTER_LAYER) ? CLUSTER_LAYER : undefined,
    );
  }
  if (!map.getLayer(ISOCHRONE_LINE)) {
    map.addLayer(
      {
        id: ISOCHRONE_LINE,
        type: "line",
        source: ISOCHRONE_SOURCE,
        paint: {
          "line-color": "#1b4332",
          "line-width": 1.5,
          "line-opacity": 0.45,
        },
      },
      map.getLayer(CLUSTER_LAYER) ? CLUSTER_LAYER : undefined,
    );
  }
}

function setIsochroneData(
  map: mapboxgl.Map,
  data: GeoJSON.FeatureCollection | null | undefined,
) {
  ensureIsochroneLayers(map);
  const source = map.getSource(ISOCHRONE_SOURCE) as
    | mapboxgl.GeoJSONSource
    | undefined;
  source?.setData(data || { type: "FeatureCollection", features: [] });
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
  altRoutesGeoJSON = null,
  isochroneGeoJSON = null,
  interactive = true,
  showNavControls = false,
  minimalControls = false,
  followUser = false,
  userLngLat = null,
  fitMarkers = false,
  fitRoute = false,
  alwaysShowLabels = true,
  flat = false,
  freeCamera = false,
  showTraffic = false,
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
  const altRoutesRef = useRef(altRoutesGeoJSON);
  const isochroneRef = useRef(isochroneGeoJSON);
  const vendorsRef = useRef(vendorGeoJSON);
  const styleRef = useRef(mapStyle);
  const flatRef = useRef(flat);
  const freeCameraRef = useRef(freeCamera);
  const interactiveRef = useRef(interactive);
  const pitchRef = useRef(pitch);
  const bearingRef = useRef(bearing);
  const showTrafficRef = useRef(showTraffic);

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
    altRoutesRef.current = altRoutesGeoJSON;
  }, [altRoutesGeoJSON]);
  useEffect(() => {
    isochroneRef.current = isochroneGeoJSON;
  }, [isochroneGeoJSON]);
  useEffect(() => {
    vendorsRef.current = vendorGeoJSON;
  }, [vendorGeoJSON]);
  useEffect(() => {
    flatRef.current = flat;
  }, [flat]);
  useEffect(() => {
    freeCameraRef.current = freeCamera;
  }, [freeCamera]);
  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);
  useEffect(() => {
    pitchRef.current = pitch;
  }, [pitch]);
  useEffect(() => {
    bearingRef.current = bearing;
  }, [bearing]);
  useEffect(() => {
    showTrafficRef.current = showTraffic;
  }, [showTraffic]);

  const applyCameraPose = useCallback(
    (map: mapboxgl.Map, animate = true) => {
      const isFlat = flatRef.current;
      const isFree = freeCameraRef.current;
      const canInteract = interactiveRef.current;
      const nextPitch = isFlat && !isFree ? 0 : pitchRef.current;
      const nextBearing = isFlat && !isFree ? 0 : bearingRef.current;
      const allowTilt = canInteract && (isFree || !isFlat);
      try {
        map.setMaxPitch(allowTilt ? 85 : 0);
        if (allowTilt) {
          map.dragRotate.enable();
          map.touchPitch.enable();
        } else {
          map.dragRotate.disable();
          map.touchPitch.disable();
        }
      } catch {
        /* ok */
      }
      if (animate) {
        map.easeTo({
          pitch: nextPitch,
          bearing: nextBearing,
          duration: 700,
          essential: true,
        });
      } else {
        map.jumpTo({ pitch: nextPitch, bearing: nextBearing });
      }
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = getMapboxToken();
    if (!token) return;

    mapboxgl.accessToken = token;
    styleRef.current = mapStyle;

    const allowTilt = interactive && (freeCamera || !flat);
    const initialPitch = flat && !freeCamera ? 0 : pitch;
    const initialBearing = flat && !freeCamera ? 0 : bearing;

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
      logoPosition: "bottom-left",
      antialias: true,
      doubleClickZoom: interactive,
      dragRotate: allowTilt,
      touchPitch: allowTilt,
      pitchWithRotate: allowTilt,
      fadeDuration: 200,
      maxPitch: allowTilt ? 85 : 0,
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
      if (!flatRef.current) enable3D(map);
      else {
        try {
          map.setTerrain(null);
        } catch {
          /* ok */
        }
      }
      setIsochroneData(map, isochroneRef.current);
      setAltRouteData(map, altRoutesRef.current);
      setRouteData(map, routeRef.current);
      setVendorData(map, vendorsRef.current);
      setTrafficVisible(map, showTrafficRef.current);
      applyCameraPose(map, false);
    };

    map.on("style.load", onStyleReady);
    map.on("load", () => {
      onStyleReady();
      requestAnimationFrame(() => {
        map.resize();
        applyCameraPose(map, false);
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
  }, [applyCameraPose]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapStyle || mapStyle === styleRef.current) return;
    styleRef.current = mapStyle;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => setTrafficVisible(map, showTraffic);
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [showTraffic, mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (flat && !freeCamera) {
      try {
        map.setTerrain(null);
      } catch {
        /* ok */
      }
      return;
    }
    enable3D(map);
  }, [flat, freeCamera, mapStyle]);

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

      if (m.kind !== "user") {
        const shape = document.createElement("span");
        shape.className = "kc-map-marker__shape";
        el.appendChild(shape);
      }

      if (m.kind === "user" || m.pulse) {
        const pulse = document.createElement("span");
        pulse.className =
          m.kind === "place" || m.kind === "stop"
            ? "kc-map-marker__pulse kc-map-marker__pulse--place"
            : "kc-map-marker__pulse";
        el.appendChild(pulse);
      }
      if (m.kind === "stop" && m.stopIndex != null) {
        const num = document.createElement("span");
        num.className = "kc-map-marker__index";
        num.textContent = String(m.stopIndex);
        el.appendChild(num);
      } else if (m.kind === "user") {
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
    const apply = () => setAltRouteData(map, altRoutesGeoJSON);
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [altRoutesGeoJSON]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => setIsochroneData(map, isochroneGeoJSON);
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [isochroneGeoJSON]);

  const lastFitRouteKeyRef = useRef<string | null>(null);
  const lastFitMarkersKeyRef = useRef<boolean | number | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      setRouteData(map, routeGeoJSON);
      if (!fitRoute || !routeGeoJSON || routeGeoJSON.coordinates.length < 2)
        return;
      // Fit once per route geometry fingerprint — avoid GPS/route refresh jumps
      const key = `${routeGeoJSON.coordinates[0]?.join(",")}-${routeGeoJSON.coordinates[routeGeoJSON.coordinates.length - 1]?.join(",")}-${routeGeoJSON.coordinates.length}`;
      if (lastFitRouteKeyRef.current === key) return;
      lastFitRouteKeyRef.current = key;
      const bounds = new mapboxgl.LngLatBounds();
      routeGeoJSON.coordinates.forEach((c) =>
        bounds.extend(c as [number, number]),
      );
      map.fitBounds(bounds, {
        padding: { top: 120, bottom: 220, left: 48, right: 48 },
        maxZoom: 16.5,
        duration: 800,
      });
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
    // Continuous follow only while explicitly enabled (driver mode)
    map.easeTo({ center: [lng, lat], duration: 500 });
  }, [userLngLat, followUser, zoom, pitch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitMarkers) return;
    // Only run when fitMarkers key flips — not on every GPS / marker update
    if (lastFitMarkersKeyRef.current === fitMarkers) return;
    lastFitMarkersKeyRef.current = fitMarkers;

    // Prefer non-user/vendor markers (stops/places); fall back to all pins
    // so checkout (user + shops) still fits the viewport.
    let pts = markers.filter((m) => m.kind !== "vendor" && m.kind !== "user");
    if (pts.length === 0) pts = markers;
    if (pts.length === 0 && (!vendorGeoJSON || !vendorGeoJSON.features.length))
      return;
    const bounds = new mapboxgl.LngLatBounds();
    for (const m of pts) bounds.extend([m.lng, m.lat]);
    for (const f of vendorGeoJSON?.features || []) {
      if (f.geometry?.type === "Point") {
        bounds.extend(f.geometry.coordinates as [number, number]);
      }
    }
    if (bounds.isEmpty()) return;
    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 160, left: 48, right: 48 },
      maxZoom: 15.5,
      duration: 700,
    });
  }, [fitMarkers, markers, vendorGeoJSON]);

  // Center / zoom moves (blocked while fitting markers/routes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitMarkers || followUser || fitRoute) return;
    if (cameraKey != null && cameraKey === lastCameraKeyRef.current) return;
    if (cameraKey != null) lastCameraKeyRef.current = cameraKey;
    if (freeCamera && cameraKey == null) return;
    map.flyTo({
      center,
      zoom,
      pitch: flat && !freeCamera ? 0 : pitch,
      bearing: flat && !freeCamera ? 0 : bearing,
      essential: true,
      duration: 900,
    });
  }, [
    center,
    zoom,
    pitch,
    bearing,
    flat,
    freeCamera,
    fitMarkers,
    followUser,
    fitRoute,
    cameraKey,
  ]);

  // POV / pitch / bearing — always apply (fitMarkers must not block view changes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => applyCameraPose(map, true);
    if (map.isStyleLoaded()) run();
    else map.once("style.load", run);
  }, [pitch, bearing, flat, freeCamera, interactive, applyCameraPose]);

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
