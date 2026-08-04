"use client";

import { useEffect, useState } from "react";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type StorefrontSettings = {
  announcement: string;
  highlight: string;
  featuredCategory: string;
  showReviews: boolean;
  showLocations: boolean;
  showHours: boolean;
  showStory: boolean;
};

type Profile = {
  vendorPublicId: string;
  slug: string;
  name: string;
  description: string;
  story: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  socials: Record<string, string>;
  policies: {
    returns?: string;
    storefront?: StorefrontSettings;
    [key: string]: unknown;
  };
};

const DEFAULT_STOREFRONT: StorefrontSettings = {
  announcement: "",
  highlight: "",
  featuredCategory: "",
  showReviews: true,
  showLocations: true,
  showHours: true,
  showStory: true,
};

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

export default function StoreProfilePage() {
  const [vendorId, setVendorId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
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

  useEffect(() => {
    fetch("/api/os/me")
      .then((r) => r.json())
      .then(async (me) => {
        const vid = me?.data?.vendorIds?.[0];
        if (!vid) return;
        setVendorId(vid);
        const [storeRes, branchesRes] = await Promise.all([
          fetch(`/api/os/store?vendorId=${encodeURIComponent(vid)}`).then((r) =>
            r.json(),
          ),
          fetch(`/api/os/branches?vendorId=${encodeURIComponent(vid)}`).then(
            (r) => r.json(),
          ),
        ]);
        if (storeRes?.data) {
          const d = storeRes.data;
          setProfile({
            ...d,
            slug: d.slug || "",
            policies: {
              returns: d.policies?.returns || "",
              storefront: {
                ...DEFAULT_STOREFRONT,
                ...(d.policies?.storefront || {}),
              },
            },
          });
        }
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
      });
  }, []);

  async function saveProfile() {
    if (!profile || !vendorId) return;
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/os/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId, ...profile }),
    });
    const body = await res.json();
    setSaving(false);
    setStatus(res.ok ? "Profile saved" : body?.error?.message || "Save failed");
  }

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

  if (!profile) {
    return (
      <div className="w-full">
        <p className={osUi.pageEyebrow}>Store</p>
        <h1 className={cn("mt-2", osUi.pageTitle)}>Loading…</h1>
      </div>
    );
  }

  return (
    <div className="w-full space-y-14">
      <div>
        <p className={osUi.pageEyebrow}>Store</p>
        <h1
          className={cn("mt-2", osUi.pageTitle)}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Profile & hours
        </h1>
        <p className={cn("mt-2", osUi.pageDesc)}>
          Branding, contact, hours, and what customers see on your public store.
        </p>
        {profile.slug ? (
          <a
            href={`/vendors/${profile.slug}`}
            target="_blank"
            rel="noreferrer"
            className={cn("mt-4 inline-flex", osUi.btnSecondary)}
          >
            View public storefront
          </a>
        ) : null}
      </div>

      {status ? <p className="text-[14px] text-black/50">{status}</p> : null}

      <section className="grid max-w-2xl gap-6">
        <h2 className={osUi.sectionLabel}>Storefront experience</h2>
        <p className="text-[14px] text-black/45">
          Control engagement pages on{" "}
          {profile.slug ? (
            <span className="font-medium text-black">
              /vendors/{profile.slug}
            </span>
          ) : (
            "your public store"
          )}
          .
        </p>
        <label className="block">
          <span className={osUi.sectionLabel}>Announcement bar</span>
          <input
            className={cn("mt-1", osUi.input)}
            placeholder="Free pickup this weekend · Westlands"
            value={profile.policies?.storefront?.announcement || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                policies: {
                  ...profile.policies,
                  storefront: {
                    ...DEFAULT_STOREFRONT,
                    ...profile.policies?.storefront,
                    announcement: e.target.value,
                  },
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className={osUi.sectionLabel}>Homepage highlight quote</span>
          <textarea
            className={cn("mt-1 min-h-[70px]", osUi.input)}
            placeholder="Fresh from our kitchen to your table."
            value={profile.policies?.storefront?.highlight || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                policies: {
                  ...profile.policies,
                  storefront: {
                    ...DEFAULT_STOREFRONT,
                    ...profile.policies?.storefront,
                    highlight: e.target.value,
                  },
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className={osUi.sectionLabel}>Featured category name</span>
          <input
            className={cn("mt-1", osUi.input)}
            placeholder="e.g. Pastries"
            value={profile.policies?.storefront?.featuredCategory || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                policies: {
                  ...profile.policies,
                  storefront: {
                    ...DEFAULT_STOREFRONT,
                    ...profile.policies?.storefront,
                    featuredCategory: e.target.value,
                  },
                },
              })
            }
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["showStory", "Show story"],
              ["showHours", "Show hours"],
              ["showLocations", "Show locations"],
              ["showReviews", "Show reviews"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 border-t border-black/8 py-3 text-[14px] text-black/70"
            >
              <input
                type="checkbox"
                checked={profile.policies?.storefront?.[key] !== false}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    policies: {
                      ...profile.policies,
                      storefront: {
                        ...DEFAULT_STOREFRONT,
                        ...profile.policies?.storefront,
                        [key]: e.target.checked,
                      },
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="grid max-w-2xl gap-6">
        <h2 className={osUi.sectionLabel}>Branding</h2>
        {(
          [
            ["name", "Display name"],
            ["logoUrl", "Logo URL"],
            ["bannerUrl", "Banner URL"],
            ["themeColor", "Theme colour"],
            ["contactEmail", "Email"],
            ["contactPhone", "Phone"],
            ["whatsapp", "WhatsApp"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className={osUi.sectionLabel}>{label}</span>
            <input
              className={cn("mt-1", osUi.input)}
              value={String(profile[key] || "")}
              onChange={(e) =>
                setProfile({ ...profile, [key]: e.target.value })
              }
            />
          </label>
        ))}
        <label className="block">
          <span className={osUi.sectionLabel}>Description</span>
          <textarea
            className={cn("mt-1 min-h-[90px]", osUi.input)}
            value={profile.description}
            onChange={(e) =>
              setProfile({ ...profile, description: e.target.value })
            }
          />
        </label>
        <label className="block">
          <span className={osUi.sectionLabel}>Story</span>
          <textarea
            className={cn("mt-1 min-h-[90px]", osUi.input)}
            value={profile.story}
            onChange={(e) => setProfile({ ...profile, story: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={osUi.sectionLabel}>Return policy</span>
          <textarea
            className={cn("mt-1 min-h-[70px]", osUi.input)}
            value={profile.policies?.returns || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                policies: {
                  ...profile.policies,
                  storefront: {
                    ...DEFAULT_STOREFRONT,
                    ...profile.policies?.storefront,
                  },
                  returns: e.target.value,
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className={osUi.sectionLabel}>Instagram</span>
          <input
            className={cn("mt-1", osUi.input)}
            value={profile.socials?.instagram || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                socials: { ...profile.socials, instagram: e.target.value },
              })
            }
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={saveProfile}
          className={osUi.btnPrimary}
        >
          Save profile
        </button>
      </section>

      <section className="max-w-2xl space-y-4">
        <h2 className={osUi.sectionLabel}>
          Hours {storeId ? `· ${storeId.slice(0, 10)}` : "· add a branch first"}
        </h2>
        {weekly.map((d) => (
          <div
            key={d.dayOfWeek}
            className="flex flex-wrap items-center gap-4 border-t border-black/10 py-3"
          >
            <span className="w-12 text-[14px] font-medium text-black">
              {DAYS[d.dayOfWeek]}
            </span>
            <label className="flex items-center gap-2 text-[13px] text-black/50">
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
                <span className="text-black/30">-</span>
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
        <div className="space-y-3 border-t border-black/10 pt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className={osUi.sectionLabel}>Holiday overrides</h3>
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
                className="flex flex-wrap items-end gap-3 border-t border-black/8 py-3"
              >
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
                <label className="block min-w-[140px] flex-1">
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
                <label className="flex items-center gap-2 pb-3 text-[13px] text-black/50">
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
                  Closed
                </label>
                {!h.isClosed ? (
                  <>
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
                  </>
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
        </div>

        <button
          type="button"
          disabled={saving || !storeId}
          onClick={saveHours}
          className={osUi.btnSecondary}
        >
          Save hours
        </button>
      </section>
    </div>
  );
}
