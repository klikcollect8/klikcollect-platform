"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

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

export default function StoreProfilePage() {
  const [vendorId, setVendorId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/os/me")
      .then((r) => r.json())
      .then(async (me) => {
        const vid = me?.data?.vendorIds?.[0];
        if (!vid) return;
        setVendorId(vid);
        const storeRes = await fetch(
          `/api/os/store?vendorId=${encodeURIComponent(vid)}`,
        ).then((r) => r.json());
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
          Branding, contact, and what customers see on your public store.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.slug ? (
            <a
              href={`/vendors/${profile.slug}`}
              target="_blank"
              rel="noreferrer"
              className={osUi.btnSecondary}
            >
              View public storefront
            </a>
          ) : null}
          <Link href="/app/store/hours" className={osUi.btnGhost}>
            Hours & holidays
          </Link>
          <Link href="/app/branches" className={osUi.btnGhost}>
            Branches
          </Link>
        </div>
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
    </div>
  );
}
