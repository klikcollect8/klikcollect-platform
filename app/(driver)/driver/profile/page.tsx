"use client";

import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import DriverPageHeader from "@/components/driver/DriverPageHeader";
import {
  isActiveDeliveryStatus,
  type DriverDelivery,
} from "@/lib/driver/types";

export default function DriverProfilePage() {
  const { user } = useUser();
  const [online, setOnline] = useState(false);
  const [completedToday, setCompletedToday] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    try {
      setOnline(localStorage.getItem("klikcollect:driver-online") === "1");
    } catch {
      /* ignore */
    }
    void fetch("/api/driver/deliveries")
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data || []) as DriverDelivery[];
        const today = new Date().toISOString().slice(0, 10);
        setActiveCount(
          rows.filter((d) => isActiveDeliveryStatus(d.status)).length,
        );
        setCompletedToday(
          rows.filter(
            (d) =>
              d.status === "delivered" &&
              (d.completed_at || "").slice(0, 10) === today,
          ).length,
        );
      });
    void fetch("/api/driver/location")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.online != null) setOnline(Boolean(j.data.online));
      });
  }, []);

  const name =
    user?.fullName || user?.primaryEmailAddress?.emailAddress || "Driver";

  return (
    <div className="space-y-5">
      <DriverPageHeader
        eyebrow="Account"
        title={name}
        subtitle="Presence, today’s numbers, and your session."
      />

      <div className="grid grid-cols-3 gap-2.5">
        {[
          {
            value: online ? "On" : "Off",
            label: "Status",
            accent: online ? "text-emerald-700" : "text-[#111]",
          },
          {
            value: String(activeCount),
            label: "Active",
            accent: "text-[#111]",
          },
          {
            value: String(completedToday),
            label: "Done today",
            accent: "text-[#111]",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[20px] bg-white px-3 py-4 text-center shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]"
          >
            <p
              className={`text-[22px] font-semibold tabular-nums ${stat.accent}`}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-[22px] bg-white px-4 py-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Clerk account</p>
          <p className="truncate text-[12px] text-black/45">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
        <UserButton />
      </div>
    </div>
  );
}
