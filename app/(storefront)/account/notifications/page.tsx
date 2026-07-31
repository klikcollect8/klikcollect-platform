"use client";

import { useEffect, useState } from "react";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";

const PREFS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: "orderUpdates", label: "Order updates", desc: "Pickup status and collection reminders." },
  { key: "priceDrops", label: "Price drops", desc: "When wishlist items go on sale." },
  { key: "newProducts", label: "New products", desc: "Fresh drops from Nairobi vendors." },
  { key: "promotions", label: "Promotions", desc: "Offers and seasonal campaigns." },
];

export default function AccountNotificationsPage() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    setPrefs(loadNotificationPrefs());
  }, []);

  const toggle = (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    saveNotificationPrefs(next);
    showToast("Notification preferences saved", "success");
  };

  return (
    <div className="space-y-10 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Notifications
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          Choose what we should email you about.
        </p>
      </div>

      {!prefs ? (
        <p className="text-[14px] text-black/35">Loading…</p>
      ) : (
        <ul>
          {PREFS.map((pref) => (
            <li key={pref.key}>
              <button
                type="button"
                onClick={() => toggle(pref.key)}
                className="flex w-full items-center justify-between gap-4 border-b border-black/[0.08] py-4 text-left transition-colors hover:text-black"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-black">{pref.label}</p>
                  <p className="mt-0.5 text-[13px] text-black/35">{pref.desc}</p>
                </div>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-black/25">
                  {prefs[pref.key] ? "On" : "Off"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
