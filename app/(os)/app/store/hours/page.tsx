"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayHours = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

type Holiday = {
  date: string;
  label: string;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

export default function StoreHoursPage() {
  const [vendorId, setVendorId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [weekly, setWeekly] = useState<DayHours[]>(
    DAYS.map((_, i) => ({
      dayOfWeek: i,
      openTime: "09:00",
      closeTime: "18:00",
      isClosed: i === 0,
    })),
  );
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/os/me")
      .then((r) => r.json())
      .then(async (me) => {
        const vid = me?.data?.vendorIds?.[0];
        if (!vid) {
          setLoaded(true);
          return;
        }
        setVendorId(vid);
        const branchesRes = await fetch(
          `/api/os/branches?vendorId=${encodeURIComponent(vid)}`,
        ).then((r) => r.json());
        const primary =
          (branchesRes?.data || []).find(
            (s: { is_primary: boolean }) => s.is_primary,
          ) || branchesRes?.data?.[0];
        if (primary?.public_id) {
          setStoreId(primary.public_id);
          const hours = await fetch(
            `/api/os/store/hours?vendorId=${encodeURIComponent(vid)}&storeId=${encodeURIComponent(primary.public_id)}`,
          ).then((r) => r.json());
          const rows = hours?.data || [];
          if (rows.length) {
            setWeekly(
              DAYS.map((_, i) => {
                const row = rows.find(
                  (r: { day_of_week: number | null }) => r.day_of_week === i,
                );
                return {
                  dayOfWeek: i,
                  openTime: row?.open_time?.slice(0, 5) || "09:00",
                  closeTime: row?.close_time?.slice(0, 5) || "18:00",
                  isClosed: row ? !!row.is_closed : i === 0,
                };
              }),
            );
            setHolidays(
              rows
                .filter(
                  (r: { holiday_date?: string | null }) => !!r.holiday_date,
                )
                .map(
                  (r: {
                    holiday_date: string;
                    holiday_label?: string;
                    is_closed?: boolean;
                    open_time?: string;
                    close_time?: string;
                  }) => ({
                    date: String(r.holiday_date).slice(0, 10),
                    label: r.holiday_label || "Holiday",
                    isClosed: r.is_closed !== false,
                    openTime: r.open_time?.slice(0, 5) || "09:00",
                    closeTime: r.close_time?.slice(0, 5) || "18:00",
                  }),
                ),
            );
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function saveHours() {
    if (!vendorId || !storeId) {
      setStatus("Create a branch first to set hours");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/os/store/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId, storeId, weekly, holidays }),
    });
    setSaving(false);
    setStatus(res.ok ? "Hours saved" : "Hours save failed");
  }

  if (!loaded) {
    return (
      <div className="w-full">
        <p className={osUi.pageEyebrow}>Store</p>
        <h1 className={cn("mt-2", osUi.pageTitle)}>Loading…</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-10 pb-28">
      <div>
        <Link
          href="/app/store"
          className="inline-flex min-h-11 items-center text-[13px] text-black/45 underline underline-offset-4"
        >
          ← Storefront
        </Link>
        <p className={cn("mt-4", osUi.pageEyebrow)}>Store</p>
        <h1
          className={cn("mt-2", osUi.pageTitle)}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Hours & holidays
        </h1>
        <p className={cn("mt-2", osUi.pageDesc)}>
          Weekly hours for your primary branch
          {storeId ? ` · ${storeId.slice(0, 10)}` : " · add a branch first"}.
        </p>
      </div>

      {status ? <p className="text-[14px] text-black/50">{status}</p> : null}

      <section className="space-y-1 border-y border-black/10">
        {weekly.map((d) => (
          <div
            key={d.dayOfWeek}
            className="flex flex-wrap items-center gap-3 border-b border-black/10 py-3.5 last:border-b-0"
          >
            <span className="w-12 text-[14px] font-medium text-black">
              {DAYS[d.dayOfWeek]}
            </span>
            <label className="flex min-h-11 items-center gap-2 text-[13px] text-black/50">
              <input
                type="checkbox"
                checked={d.isClosed}
                onChange={(e) =>
                  setWeekly((prev) =>
                    prev.map((x) =>
                      x.dayOfWeek === d.dayOfWeek
                        ? { ...x, isClosed: e.target.checked }
                        : x,
                    ),
                  )
                }
              />
              Closed
            </label>
            {!d.isClosed ? (
              <>
                <input
                  type="time"
                  className={osUi.input}
                  value={d.openTime}
                  onChange={(e) =>
                    setWeekly((prev) =>
                      prev.map((x) =>
                        x.dayOfWeek === d.dayOfWeek
                          ? { ...x, openTime: e.target.value }
                          : x,
                      ),
                    )
                  }
                />
                <span className="text-black/30">–</span>
                <input
                  type="time"
                  className={osUi.input}
                  value={d.closeTime}
                  onChange={(e) =>
                    setWeekly((prev) =>
                      prev.map((x) =>
                        x.dayOfWeek === d.dayOfWeek
                          ? { ...x, closeTime: e.target.value }
                          : x,
                      ),
                    )
                  }
                />
              </>
            ) : null}
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className={osUi.sectionLabel}>Holiday overrides</h2>
          <button
            type="button"
            className={osUi.btnGhost}
            onClick={() =>
              setHolidays((prev) => [
                ...prev,
                {
                  date: new Date().toISOString().slice(0, 10),
                  label: "Holiday",
                  isClosed: true,
                  openTime: "09:00",
                  closeTime: "18:00",
                },
              ])
            }
          >
            Add holiday
          </button>
        </div>
        {!holidays.length ? (
          <p className="text-[13px] text-black/40">No holiday overrides.</p>
        ) : (
          holidays.map((h, idx) => (
            <div
              key={`${h.date}-${idx}`}
              className="space-y-3 border-t border-black/10 py-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={osUi.sectionLabel}>Date</span>
                  <input
                    type="date"
                    className={cn("mt-1", osUi.input)}
                    value={h.date}
                    onChange={(e) =>
                      setHolidays((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, date: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label className="block">
                  <span className={osUi.sectionLabel}>Label</span>
                  <input
                    className={cn("mt-1", osUi.input)}
                    value={h.label}
                    onChange={(e) =>
                      setHolidays((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, label: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-[13px] text-black/50">
                <input
                  type="checkbox"
                  checked={h.isClosed}
                  onChange={(e) =>
                    setHolidays((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, isClosed: e.target.checked } : x,
                      ),
                    )
                  }
                />
                Closed all day
              </label>
              {!h.isClosed ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    className={osUi.input}
                    value={h.openTime}
                    onChange={(e) =>
                      setHolidays((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, openTime: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <input
                    type="time"
                    className={osUi.input}
                    value={h.closeTime}
                    onChange={(e) =>
                      setHolidays((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, closeTime: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
              ) : null}
              <button
                type="button"
                className={osUi.btnGhost}
                onClick={() =>
                  setHolidays((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                Remove
              </button>
            </div>
          ))
        )}
      </section>

      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-black/10 bg-[var(--kc-canvas)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-0">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            disabled={saving || !storeId}
            onClick={() => void saveHours()}
            className={cn(osUi.btnPrimary, "min-h-12 w-full disabled:opacity-40")}
          >
            {saving ? "Saving…" : "Save hours"}
          </button>
        </div>
      </div>
    </div>
  );
}
