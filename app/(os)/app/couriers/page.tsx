"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type mapboxgl from "mapbox-gl";
import { ModuleShell } from "@/components/os/ModuleShell";
import { osUi } from "@/components/os/os-ui";
import type { MapMarker } from "@/components/map/MapCanvas";
import MapSearchBox from "@/components/map/MapSearchBox";
import MapChrome from "@/components/map/MapChrome";
import MapEtaHud from "@/components/map/MapEtaHud";
import MapPopupCard from "@/components/map/MapPopupCard";
import {
  NAIROBI_CENTER,
  MAP_FLAT_ZOOM,
  stylePreset,
  type MapStyleId,
} from "@/lib/mapbox";
import { fetchDirections, reverseGeocode } from "@/lib/mapbox-search";
import { openExternalMaps } from "@/lib/external-maps";
import { cn } from "@/lib/utils";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[320px] w-full items-center justify-center bg-[#dfe3e0]">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
        Loading map
      </p>
    </div>
  ),
});

type Delivery = {
  id: string;
  public_id: string;
  status: string;
  customer_name: string | null;
  address_text: string | null;
  driver_clerk_user_id: string | null;
  lat: number | null;
  lng: number | null;
  order_public_id: string | null;
  otp_code?: string | null;
  completed_at?: string | null;
  pod?: {
    photoUrl?: string;
    signatureUrl?: string;
    otp?: string;
    note?: string;
    [key: string]: unknown;
  } | null;
};

type DriverLoc = {
  clerk_user_id: string;
  lat: number;
  lng: number;
  online: boolean;
};

const OPEN = new Set(["pending", "assigned", "picked_up", "in_transit"]);

export default function CouriersPage() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  const [vendorId, setVendorId] = useState("");
  const [rows, setRows] = useState<Delivery[]>([]);
  const [driverLocs, setDriverLocs] = useState<DriverLoc[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [orderId, setOrderId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [drivers, setDrivers] = useState<
    { clerkUserId: string; label: string }[]
  >([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastOtp, setLastOtp] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [styleId, setStyleId] = useState<MapStyleId>("street");
  const [route, setRoute] = useState<GeoJSON.LineString | null>(null);
  const [routeMeta, setRouteMeta] = useState<{
    distanceM: number;
    durationS: number;
  } | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [center, setCenter] = useState<[number, number]>(NAIROBI_CENTER);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback((vid: string) => {
    if (!vid) return;
    void fetch(`/api/os/deliveries?vendorId=${encodeURIComponent(vid)}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data || []);
        setDriverLocs(j.driver_locations || []);
      });
  }, []);

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const id = b?.data?.vendorIds?.[0] || "";
        setVendorId(id);
        if (id) {
          load(id);
          void fetch(`/api/os/staff?vendorId=${encodeURIComponent(id)}`)
            .then((r) => r.json())
            .then((sRes) => {
              const DRIVER_ROLES = new Set([
                "vendor_driver",
                "independent_driver",
                "fleet_manager",
                "dispatch_manager",
              ]);
              const staff = (sRes?.data || []) as Array<{
                clerk_user_id?: string;
                email?: string | null;
                role?: string;
              }>;
              setDrivers(
                staff
                  .filter(
                    (s) =>
                      DRIVER_ROLES.has(String(s.role || "")) &&
                      s.clerk_user_id &&
                      !String(s.clerk_user_id).startsWith("email:"),
                  )
                  .map((s) => ({
                    clerkUserId: String(s.clerk_user_id),
                    label: `${s.email || s.clerk_user_id} · ${s.role}`,
                  })),
              );
            });
        }
      });
  }, [load]);

  useEffect(() => {
    if (!vendorId) return;
    const t = setInterval(() => load(vendorId), 12_000);
    return () => clearInterval(t);
  }, [vendorId, load]);

  const filteredRows = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return rows.filter((d) => {
      if (statusFilter === "open" && !OPEN.has(d.status)) return false;
      if (statusFilter !== "open" && statusFilter !== "all" && d.status !== statusFilter)
        return false;
      if (!q) return true;
      return (
        (d.customer_name || "").toLowerCase().includes(q) ||
        (d.address_text || "").toLowerCase().includes(q) ||
        d.public_id.toLowerCase().includes(q) ||
        (d.driver_clerk_user_id || "").toLowerCase().includes(q)
      );
    });
  }, [rows, statusFilter, listQuery]);

  const visibleDrivers = useMemo(
    () =>
      onlineOnly ? driverLocs.filter((d) => d.online) : driverLocs,
    [driverLocs, onlineOnly],
  );

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  const markers: MapMarker[] = useMemo(() => {
    const jobMarkers: MapMarker[] = filteredRows
      .filter(
        (d) =>
          d.lat != null &&
          d.lng != null &&
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lng),
      )
      .map((d) => ({
        id: `job-${d.id}`,
        lng: d.lng as number,
        lat: d.lat as number,
        label: d.customer_name || d.public_id,
        kind: "dropoff" as const,
        active: selectedId === d.id,
      }));

    const driverMarkers: MapMarker[] = visibleDrivers
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))
      .map((d) => ({
        id: `drv-${d.clerk_user_id}`,
        lng: d.lng,
        lat: d.lat,
        label: d.online ? "Online" : "Offline",
        kind: "driver" as const,
        active: d.online,
      }));

    const pin: MapMarker[] = [];
    const pinLat = Number(lat);
    const pinLng = Number(lng);
    if (Number.isFinite(pinLat) && Number.isFinite(pinLng) && lat && lng) {
      pin.push({
        id: "create-pin",
        lat: pinLat,
        lng: pinLng,
        kind: "place",
        label: "New dropoff",
        active: true,
      });
    }

    return [...jobMarkers, ...driverMarkers, ...pin];
  }, [filteredRows, visibleDrivers, selectedId, lat, lng]);

  const mapCenter = useMemo((): [number, number] => {
    if (selected?.lng != null && selected?.lat != null) {
      return [selected.lng, selected.lat];
    }
    const first = markers[0];
    if (first) return [first.lng, first.lat];
    return center;
  }, [markers, selected, center]);

  const assignedDriverLoc = useMemo(() => {
    if (!selected?.driver_clerk_user_id) return null;
    return (
      driverLocs.find(
        (d) => d.clerk_user_id === selected.driver_clerk_user_id,
      ) || null
    );
  }, [selected, driverLocs]);

  useEffect(() => {
    if (
      !selected ||
      selected.lat == null ||
      selected.lng == null ||
      !assignedDriverLoc
    ) {
      setRoute(null);
      setRouteMeta(null);
      return;
    }
    let cancelled = false;
    void fetchDirections(
      { lng: assignedDriverLoc.lng, lat: assignedDriverLoc.lat },
      { lng: selected.lng, lat: selected.lat },
      "driving-traffic",
    ).then((dir) => {
      if (cancelled || !dir) return;
      setRoute(dir.geometry);
      setRouteMeta({ distanceM: dir.distanceM, durationS: dir.durationS });
    });
    return () => {
      cancelled = true;
    };
  }, [
    selected?.id,
    selected?.lat,
    selected?.lng,
    assignedDriverLoc?.lat,
    assignedDriverLoc?.lng,
  ]);

  const create = async () => {
    setMsg(null);
    const res = await fetch("/api/os/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId,
        customerName,
        addressText,
        orderId: orderId || undefined,
        lat: lat || undefined,
        lng: lng || undefined,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      setMsg(j.error?.message || "Failed");
      setLastOtp(null);
      return;
    }
    const otp = j.data?.otp_code ? String(j.data.otp_code) : null;
    setLastOtp(otp);
    setMsg(otp ? `Delivery created · customer OTP ${otp}` : "Delivery created");
    setCustomerName("");
    setAddressText("");
    setLat("");
    setLng("");
    setOrderId("");
    setShowCreate(false);
    if (j.data?.id) setSelectedId(String(j.data.id));
    if (driverId && j.data?.id) {
      await fetch("/api/os/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          vendorId,
          id: j.data.id,
          driverClerkUserId: driverId,
        }),
      });
    }
    load(vendorId);
  };

  const assign = async (id: string) => {
    setMsg(null);
    const res = await fetch("/api/os/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        vendorId,
        id,
        driverClerkUserId: driverId,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? "Assigned" : j.error?.message || "Assign failed");
    if (res.ok) load(vendorId);
  };

  const preset = stylePreset(styleId);
  const flat = Boolean(preset.flat);
  const mapStyle = preset.url;

  const onlineCount = driverLocs.filter((d) => d.online).length;

  return (
    <ModuleShell
      title="Delivery"
      description="Live dispatch — assign drivers, track fleet, preview routes."
      live
      actions={
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={osUi.btnPrimary}
        >
          {showCreate ? "Close form" : "New delivery"}
        </button>
      }
    >
      <p className={cn("mb-4 text-[13px]", osUi.muted)}>
        Live delivery map · refreshes every 12s · {onlineCount} online.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
        <div
          ref={mapWrapRef}
          className="relative h-[420px] w-full overflow-hidden border border-black/10 sm:h-[520px] lg:h-[640px]"
        >
          <MapCanvas
            className="h-full w-full"
            mapStyle={mapStyle}
            flat={flat}
            center={mapCenter}
            zoom={MAP_FLAT_ZOOM}
            pitch={flat ? 0 : preset.defaultPitch}
            markers={markers}
            routeGeoJSON={route}
            fitRoute={!!route}
            fitMarkers={!selected && markers.length > 1}
            interactive
            cameraKey={cameraKey}
            onMarkerClick={(id) => {
              if (id.startsWith("job-")) setSelectedId(id.slice(4));
            }}
            onMapClick={(ll) => {
              setLat(String(ll.lat.toFixed(6)));
              setLng(String(ll.lng.toFixed(6)));
              void reverseGeocode(ll.lng, ll.lat).then((label) => {
                if (label) setAddressText(label);
              });
              setShowCreate(true);
            }}
            onReady={(map) => {
              mapRef.current = map;
            }}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3">
            <div className="pointer-events-auto max-w-md">
              <MapSearchBox
                placeholder="Search dropoff address…"
                onSelect={(hit) => {
                  setLat(String(hit.lat));
                  setLng(String(hit.lng));
                  setAddressText(hit.fullAddress || hit.name);
                  setCenter([hit.lng, hit.lat]);
                  setCameraKey((k) => k + 1);
                  setShowCreate(true);
                }}
              />
            </div>
          </div>

          <div className="pointer-events-none absolute right-3 top-16 z-20">
            <MapChrome
              styleId={styleId}
              onStyleChange={setStyleId}
              onRecenter={() => {
                setCenter(NAIROBI_CENTER);
                setCameraKey((k) => k + 1);
              }}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onFullscreen={() => {
                const el = mapWrapRef.current;
                if (!el) return;
                if (document.fullscreenElement) void document.exitFullscreen();
                else void el.requestFullscreen?.();
              }}
              compact
            />
          </div>

          {routeMeta ? (
            <div className="pointer-events-none absolute left-3 top-16 z-20">
              <MapEtaHud
                distanceM={routeMeta.distanceM}
                durationS={routeMeta.durationS}
                label="Driver → drop"
              />
            </div>
          ) : null}

          {selected ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-xs">
              <div className="pointer-events-auto">
                <MapPopupCard
                  title={selected.customer_name || selected.public_id}
                  subtitle={selected.address_text || "No address"}
                  meta={[selected.status, selected.driver_clerk_user_id ? "Assigned" : "Unassigned"]}
                  actions={
                    <>
                      {selected.lat != null && selected.lng != null ? (
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center border border-black/15 px-3 text-[10px] font-medium uppercase tracking-[0.12em]"
                          onClick={() =>
                            openExternalMaps(
                              {
                                lat: selected.lat!,
                                lng: selected.lng!,
                                label: selected.address_text || undefined,
                              },
                              "directions",
                            )
                          }
                        >
                          Google Maps
                        </button>
                      ) : null}
                    </>
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        <aside className="flex min-h-0 flex-col border border-black/10">
          <div className="space-y-2 border-b border-black/10 p-4">
            <input
              className={osUi.input}
              placeholder="Search jobs…"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["open", "Open"],
                  ["all", "All"],
                  ["pending", "Pending"],
                  ["assigned", "Assigned"],
                  ["in_transit", "In transit"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={cn(
                    "h-8 px-2.5 text-[11px] font-medium uppercase tracking-[0.1em]",
                    statusFilter === id
                      ? "bg-black text-white"
                      : "border border-black/12 text-black/50",
                  )}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setOnlineOnly((v) => !v)}
                className={cn(
                  "h-8 px-2.5 text-[11px] font-medium uppercase tracking-[0.1em]",
                  onlineOnly
                    ? "bg-emerald-700 text-white"
                    : "border border-black/12 text-black/50",
                )}
              >
                Online drivers
              </button>
            </div>
            {drivers.length ? (
              <select
                className={cn(osUi.input, "bg-transparent")}
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="">Assign driver…</option>
                {drivers.map((d) => (
                  <option key={d.clerkUserId} value={d.clerkUserId}>
                    {d.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={osUi.input}
                placeholder="Driver Clerk user id"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              />
            )}
          </div>

          <div className="min-h-0 flex-1 divide-y divide-black/[0.06] overflow-y-auto">
            {filteredRows.map((d) => (
              <div
                key={d.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]",
                  selectedId === d.id && "bg-black/[0.03]",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setSelectedId(d.id);
                    if (d.lng != null && d.lat != null) {
                      setCenter([d.lng, d.lat]);
                      setCameraKey((k) => k + 1);
                    }
                  }}
                >
                  <p className="font-medium text-black">{d.public_id}</p>
                  <p className={osUi.muted}>
                    {d.customer_name || "—"} · {d.status}
                  </p>
                  {d.address_text ? (
                    <p className={cn("mt-0.5 truncate text-[12px]", osUi.muted)}>
                      {d.address_text}
                    </p>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={osUi.btnGhost}
                  disabled={!driverId}
                  onClick={() => void assign(d.id)}
                >
                  Assign
                </button>
              </div>
            ))}
            {!filteredRows.length ? (
              <p className={cn("px-4 py-8 text-[14px]", osUi.muted)}>
                No deliveries match.
              </p>
            ) : null}
          </div>

          {selected ? (
            <div className="border-t border-black/10 p-4 text-[13px]">
              <p className={osUi.sectionLabel}>Proof of delivery</p>
              <p className="mt-2 font-medium">{selected.public_id}</p>
              {selected.otp_code ? (
                <p className="mt-1 text-[20px] font-medium tracking-[0.18em] tabular-nums">
                  {selected.otp_code}
                </p>
              ) : null}
              {!selected.pod ? (
                <p className={cn("mt-2", osUi.muted)}>No POD yet.</p>
              ) : (
                <p className={cn("mt-2", osUi.muted)}>
                  POD captured
                  {selected.pod.note ? ` · ${String(selected.pod.note)}` : ""}
                </p>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      {showCreate ? (
        <div className="mt-6 grid gap-3 border border-black/10 p-4 sm:grid-cols-2">
          <p className={cn("sm:col-span-2 text-[12px]", osUi.muted)}>
            Click the map or search to set dropoff coordinates.
          </p>
          <input
            className={osUi.input}
            placeholder="Customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <input
            className={osUi.input}
            placeholder="Order public id (optional)"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
          <input
            className={cn(osUi.input, "sm:col-span-2")}
            placeholder="Address"
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
          />
          <input
            className={osUi.input}
            placeholder="Latitude"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <input
            className={osUi.input}
            placeholder="Longitude"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void create()}
            disabled={!vendorId || !customerName}
            className={cn(osUi.btnPrimary, "sm:col-span-2")}
          >
            Create delivery
          </button>
        </div>
      ) : null}

      {msg ? <p className={cn("mt-4 text-[13px]", osUi.muted)}>{msg}</p> : null}
      {lastOtp ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-[28px] font-medium tracking-[0.2em] tabular-nums">
            {lastOtp}
          </p>
          <button
            type="button"
            className={osUi.btnGhost}
            onClick={() => void navigator.clipboard.writeText(lastOtp)}
          >
            Copy OTP
          </button>
        </div>
      ) : null}
    </ModuleShell>
  );
}
