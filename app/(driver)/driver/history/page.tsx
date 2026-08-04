"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buildStaticMapUrl } from "@/lib/mapbox";
import type { DriverDelivery } from "@/lib/driver/types";
import DriverPageHeader from "@/components/driver/DriverPageHeader";

export default function DriverHistoryPage() {
  const [rows, setRows] = useState<DriverDelivery[]>([]);

  useEffect(() => {
    void fetch("/api/driver/deliveries")
      .then((r) => r.json())
      .then((j) =>
        setRows(
          ((j.data || []) as DriverDelivery[]).filter(
            (d) => d.status === "delivered",
          ),
        ),
      );
  }, []);

  return (
    <div className="space-y-5">
      <DriverPageHeader
        eyebrow="Activity"
        title="History"
        subtitle="Completed drop-offs with a map snapshot when coordinates exist."
      />

      <div className="space-y-3">
        {rows.map((r) => {
          const staticUrl =
            r.lat != null && r.lng != null
              ? buildStaticMapUrl({
                  lng: r.lng,
                  lat: r.lat,
                  zoom: 14,
                  width: 640,
                  height: 240,
                })
              : null;
          return (
            <article
              key={r.id || r.public_id}
              className="overflow-hidden rounded-[22px] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]"
            >
              {staticUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={staticUrl}
                  alt=""
                  className="h-32 w-full object-cover"
                />
              ) : (
                <div className="flex h-20 items-center justify-center bg-gradient-to-br from-black/[0.04] to-emerald-500/10">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600/70" />
                </div>
              )}
              <div className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">
                      {r.customer_name || r.public_id}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-black/45">
                      {r.address_text || r.public_id}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Done
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-black/35">
                  {r.completed_at?.slice(0, 10) || "Delivered"}
                </p>
              </div>
            </article>
          );
        })}
        {!rows.length ? (
          <div className="rounded-[22px] border border-dashed border-black/12 bg-white/60 px-5 py-10 text-center">
            <p className="text-[14px] font-medium text-black/45">
              No completed deliveries yet
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
