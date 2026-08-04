"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { osUi } from "@/components/os/os-ui";
import type { MapMarker } from "@/components/map/MapCanvas";
import { MAPBOX_FLAT_STYLE, NAIROBI_CENTER, MAP_FLAT_ZOOM } from "@/lib/mapbox";
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

  const load = (vid: string) =>
    void fetch(`/api/os/deliveries?vendorId=${encodeURIComponent(vid)}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data || []);
        setDriverLocs(j.driver_locations || []);
      });

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
  }, []);

  const markers: MapMarker[] = useMemo(() => {
    const jobMarkers: MapMarker[] = rows
      .filter(
        (d) =>
          OPEN.has(d.status) &&
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
        kind: "pickup" as const,
      }));

    const driverMarkers: MapMarker[] = driverLocs
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng))
      .map((d) => ({
        id: `drv-${d.clerk_user_id}`,
        lng: d.lng,
        lat: d.lat,
        label: d.online ? "Driver online" : "Driver",
        kind: "user" as const,
        active: d.online,
      }));

    return [...jobMarkers, ...driverMarkers];
  }, [rows, driverLocs]);

  const mapCenter = useMemo((): [number, number] => {
    const first = markers[0];
    if (first) return [first.lng, first.lat];
    return NAIROBI_CENTER;
  }, [markers]);

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

  return (
    <ModuleShell
      title="Delivery"
      description="Dispatch open jobs and track assigned drivers on the map."
      live
    >
      <p className={cn("mb-4 text-[13px]", osUi.muted)}>
        Drivers use{" "}
        <Link className="underline" href="/driver">
          /driver
        </Link>
        .
      </p>

      <div className="mb-6 h-[360px] w-full overflow-hidden border border-black/10 sm:h-[420px]">
        <MapCanvas
          className="h-full w-full"
          mapStyle={MAPBOX_FLAT_STYLE}
          flat
          center={mapCenter}
          zoom={MAP_FLAT_ZOOM}
          markers={markers}
          fitMarkers={markers.length > 1}
          interactive
          minimalControls
        />
      </div>

      <div className="grid gap-3 border-b border-black/10 pb-6 sm:grid-cols-2">
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
        {drivers.length ? (
          <select
            className={cn(osUi.input, "bg-transparent sm:col-span-2")}
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            <option value="">Driver to assign (optional)</option>
            {drivers.map((d) => (
              <option key={d.clerkUserId} value={d.clerkUserId}>
                {d.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={cn(osUi.input, "sm:col-span-2")}
            placeholder="Driver Clerk user id to assign"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          />
        )}
        <button
          type="button"
          onClick={() => void create()}
          disabled={!vendorId || !customerName}
          className={cn(osUi.btnPrimary, "sm:col-span-2")}
        >
          Create delivery
        </button>
      </div>

      {msg ? <p className={cn("mt-4 text-[13px]", osUi.muted)}>{msg}</p> : null}
      {lastOtp ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 border-b border-black/10 pb-4">
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

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="divide-y divide-black/[0.06]">
          {rows.map((d) => (
            <div
              key={d.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]",
                selectedId === d.id && "bg-black/[0.02]",
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setSelectedId(d.id)}
              >
                <p className="font-medium text-black">{d.public_id}</p>
                <p className={osUi.muted}>
                  {d.customer_name || " - "} · {d.status}
                  {d.lat != null && d.lng != null
                    ? ` · ${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}`
                    : ""}
                </p>
                {d.driver_clerk_user_id ? (
                  <p className={cn("mt-0.5 text-[12px]", osUi.muted)}>
                    Driver {d.driver_clerk_user_id}
                  </p>
                ) : null}
              </button>
              <button
                type="button"
                className={osUi.btnGhost}
                disabled={!driverId}
                onClick={() => void assign(d.id)}
              >
                Assign driver
              </button>
            </div>
          ))}
          {!rows.length ? (
            <p className={cn("py-6 text-[14px]", osUi.muted)}>
              No deliveries yet.
            </p>
          ) : null}
        </div>

        <aside className="h-fit border-t border-black/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className={osUi.sectionLabel}>Proof of delivery</p>
          {(() => {
            const d = rows.find((r) => r.id === selectedId);
            if (!d) {
              return (
                <p className={cn("mt-3 text-[13px]", osUi.muted)}>
                  Select a delivery to view POD (read-only).
                </p>
              );
            }
            const pod = d.pod || null;
            const photo =
              pod?.photoUrl ||
              (pod?.photoDataUrl as string | undefined) ||
              null;
            const signature =
              pod?.signatureUrl ||
              (pod?.signatureDataUrl as string | undefined) ||
              null;
            return (
              <div className="mt-3 space-y-2 text-[13px]">
                <p className="font-medium text-black">{d.public_id}</p>
                <p className={osUi.muted}>Status · {d.status}</p>
                {d.completed_at ? (
                  <p className={osUi.muted}>
                    Completed {new Date(d.completed_at).toLocaleString("en-KE")}
                  </p>
                ) : null}
                {d.otp_code ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[20px] font-medium tracking-[0.18em] tabular-nums">
                      {d.otp_code}
                    </p>
                    <button
                      type="button"
                      className={osUi.btnGhost}
                      onClick={() =>
                        void navigator.clipboard.writeText(String(d.otp_code))
                      }
                    >
                      Copy
                    </button>
                  </div>
                ) : null}
                {!pod ? (
                  <p className={cn("pt-2", osUi.muted)}>No POD captured yet.</p>
                ) : (
                  <div className="space-y-2 border-t border-black/10 pt-3">
                    {pod.otp ? <p>OTP verified · {String(pod.otp)}</p> : null}
                    {pod.note ? <p>{String(pod.note)}</p> : null}
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(photo)}
                        alt="POD photo"
                        className="max-h-40 w-full object-cover"
                      />
                    ) : (
                      <p className={osUi.muted}>No photo</p>
                    )}
                    {signature ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(signature)}
                        alt="POD signature"
                        className="max-h-24 w-full bg-white object-contain"
                      />
                    ) : (
                      <p className={osUi.muted}>No signature</p>
                    )}
                    <p className={cn("text-[11px]", osUi.muted)}>
                      View only - drivers capture POD in /driver
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </aside>
      </div>
    </ModuleShell>
  );
}
