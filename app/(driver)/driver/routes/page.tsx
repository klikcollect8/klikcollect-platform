"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Navigation2 } from "lucide-react";
import { useUserLocation } from "@/components/providers/LocationProvider";
import DriverPageHeader from "@/components/driver/DriverPageHeader";
import {
  isActiveDeliveryStatus,
  type DriverDelivery,
} from "@/lib/driver/types";
import { distanceKm, formatDistanceKm } from "@/lib/mapbox";
import { forwardGeocode } from "@/lib/mapbox-search";

export default function DriverJobsPage() {
  const { coords } = useUserLocation();
  const [rows, setRows] = useState<DriverDelivery[]>([]);
  const geocodeTried = useRef<Set<string>>(new Set());

  const load = () =>
    void fetch("/api/driver/deliveries")
      .then((r) => r.json())
      .then((j) => setRows((j.data || []) as DriverDelivery[]));

  useEffect(() => {
    load();
  }, []);

  const active = useMemo(
    () => rows.filter((d) => isActiveDeliveryStatus(d.status)),
    [rows],
  );

  useEffect(() => {
    const missing = active.filter(
      (d) =>
        (d.lat == null || d.lng == null) &&
        d.address_text &&
        !geocodeTried.current.has(d.id),
    );
    if (!missing.length) return;
    void (async () => {
      for (const d of missing.slice(0, 5)) {
        geocodeTried.current.add(d.id);
        const hit = await forwardGeocode(d.address_text!, coords || undefined);
        if (!hit) continue;
        await fetch("/api/driver/deliveries", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.id, lat: hit.lat, lng: hit.lng }),
        });
      }
      load();
    })();
  }, [active, coords]);

  const sorted = useMemo(() => {
    if (!coords) return active;
    return [...active].sort((a, b) => {
      const da =
        a.lat != null && a.lng != null
          ? distanceKm(
              { lat: coords.lat, lng: coords.lng },
              { lat: a.lat, lng: a.lng },
            )
          : 9999;
      const db =
        b.lat != null && b.lng != null
          ? distanceKm(
              { lat: coords.lat, lng: coords.lng },
              { lat: b.lat, lng: b.lng },
            )
          : 9999;
      return da - db;
    });
  }, [active, coords]);

  return (
    <div className="space-y-5">
      <DriverPageHeader
        eyebrow="Jobs"
        title="Assigned stops"
        subtitle="Closest first when GPS is on. Tap a stop to open live map navigation."
      />

      <div className="space-y-3">
        {sorted.map((d, i) => {
          const km =
            coords && d.lat != null && d.lng != null
              ? distanceKm(
                  { lat: coords.lat, lng: coords.lng },
                  { lat: d.lat, lng: d.lng },
                )
              : null;
          return (
            <Link
              key={d.id}
              href={`/driver?focus=${encodeURIComponent(d.id)}`}
              className="flex items-center gap-3.5 rounded-[22px] bg-white px-4 py-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05] transition active:scale-[0.99]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111] text-[14px] font-bold text-white">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {d.customer_name || d.public_id}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-black/45">
                  {d.address_text || "No address"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/45">
                    {d.status.replace("_", " ")}
                  </span>
                  {km != null ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a73e8]">
                      <Navigation2 className="h-3 w-3" />
                      {formatDistanceKm(km)}
                    </span>
                  ) : null}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-black/20" />
            </Link>
          );
        })}
        {!sorted.length ? (
          <div className="rounded-[22px] border border-dashed border-black/12 bg-white/60 px-5 py-10 text-center">
            <p className="text-[14px] font-medium text-black/45">
              No active assigned jobs
            </p>
            <p className="mt-1 text-[12px] text-black/35">
              Dispatch will push stops here when ready.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
