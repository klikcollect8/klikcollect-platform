"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadAccountPreferences,
  saveAccountPreferences,
  type AccountPreferences,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

export default function AccountPreferencesPage() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<AccountPreferences | null>(null);

  useEffect(() => {
    setPrefs(loadAccountPreferences());
  }, []);

  const update = <K extends keyof AccountPreferences>(key: K, value: AccountPreferences[K]) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveAccountPreferences(next);
    showToast("Preferences saved", "success");
  };

  return (
    <div className="space-y-10">
      <div>
        <p className={ui.pageEyebrow}>Account</p>
        <h1 className={`mt-3 ${ui.pageTitle}`}>Preferences</h1>
        <p className={cn("mt-2", ui.pageDesc)}>How you hear from us and how prices display.</p>
      </div>

      <section className={ui.panel}>
        {!prefs ? (
          <p className="p-6 text-[13px] text-[var(--kc-faint)]">Loading…</p>
        ) : (
          <div className="divide-y divide-[var(--kc-line-soft)]">
            <div className="p-4">
              <label className="block text-[14px] font-medium text-[var(--kc-ink)]">Email digest</label>
              <p className="mb-2 text-[12px] text-[var(--kc-mute)]">Batch non-urgent updates.</p>
              <select
                value={prefs.emailDigest}
                onChange={(e) =>
                  update("emailDigest", e.target.value as AccountPreferences["emailDigest"])
                }
                className={cn("w-full max-w-xs", ui.input)}
              >
                <option value="instant">Instant</option>
                <option value="daily">Daily summary</option>
                <option value="weekly">Weekly summary</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-[14px] font-medium text-[var(--kc-ink)]">SMS pickup alerts</p>
                <p className="text-[12px] text-[var(--kc-mute)]">Text when your order is ready.</p>
              </div>
              <Toggle checked={prefs.smsAlerts} onChange={() => update("smsAlerts", !prefs.smsAlerts)} />
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-[14px] font-medium text-[var(--kc-ink)]">Show prices incl. VAT</p>
                <p className="text-[12px] text-[var(--kc-mute)]">Display tax-inclusive amounts where available.</p>
              </div>
              <Toggle
                checked={prefs.showPricesInclVat}
                onChange={() => update("showPricesInclVat", !prefs.showPricesInclVat)}
              />
            </div>
          </div>
        )}
      </section>

      <p className="text-[12px] text-[var(--kc-faint)]">
        Marketing email toggles live under{" "}
        <Link href="/account/notifications" className="font-medium text-[var(--kc-ink)] hover:underline">
          Notifications
        </Link>
        .
      </p>
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
