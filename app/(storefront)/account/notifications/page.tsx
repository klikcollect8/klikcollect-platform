"use client";

import { useEffect, useState } from "react";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

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
    <div className="space-y-10">
      <div>
        <p className={ui.pageEyebrow}>Account</p>
        <h1 className={`mt-3 ${ui.pageTitle}`}>Notifications</h1>
        <p className={cn("mt-2", ui.pageDesc)}>Choose what we should email you about.</p>
      </div>

      <section className={ui.panel}>
        {!prefs ? (
          <p className="p-6 text-[13px] text-[var(--kc-faint)]">Loading…</p>
        ) : (
          <ul className="divide-y divide-[var(--kc-line-soft)]">
            {PREFS.map((pref) => (
              <li key={pref.key} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-[14px] font-medium text-[var(--kc-ink)]">{pref.label}</p>
                  <p className="text-[12px] text-[var(--kc-mute)]">{pref.desc}</p>
                </div>
                <Toggle checked={prefs[pref.key]} onChange={() => toggle(pref.key)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-[var(--kc-ink)]" : "bg-[var(--kc-line)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
