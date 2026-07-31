"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadAccountPreferences,
  saveAccountPreferences,
  type AccountPreferences,
} from "@/lib/account-storage";
import { useToast } from "@/components/ToastProvider";

const fieldClass =
  "h-auto w-full border-0 border-b border-black/15 bg-transparent px-0 py-3 text-[15px] text-black outline-none focus:border-black/50";
const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-black/35";

export default function AccountPreferencesPage() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<AccountPreferences | null>(null);

  useEffect(() => {
    setPrefs(loadAccountPreferences());
  }, []);

  const update = <K extends keyof AccountPreferences>(
    key: K,
    value: AccountPreferences[K],
  ) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    saveAccountPreferences(next);
    showToast("Preferences saved", "success");
  };

  return (
    <div className="space-y-10 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Preferences
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          How you hear from us and how prices display.
        </p>
      </div>

      {!prefs ? (
        <p className="text-[14px] text-black/35">Loading…</p>
      ) : (
        <div className="space-y-0">
          <div className="border-b border-black/[0.08] py-4">
            <label className="block text-left">
              <span className={labelClass}>Email digest</span>
              <p className="mt-1 text-[13px] text-black/35">
                Batch non-urgent updates.
              </p>
              <select
                value={prefs.emailDigest}
                onChange={(e) =>
                  update(
                    "emailDigest",
                    e.target.value as AccountPreferences["emailDigest"],
                  )
                }
                className={`mt-1 ${fieldClass}`}
              >
                <option value="instant">Instant</option>
                <option value="daily">Daily summary</option>
                <option value="weekly">Weekly summary</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => update("smsAlerts", !prefs.smsAlerts)}
            className="flex w-full items-center justify-between gap-4 border-b border-black/[0.08] py-4 text-left transition-colors hover:text-black"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-black">SMS pickup alerts</p>
              <p className="mt-0.5 text-[13px] text-black/35">
                Text when your order is ready.
              </p>
            </div>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-black/25">
              {prefs.smsAlerts ? "On" : "Off"}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              update("showPricesInclVat", !prefs.showPricesInclVat)
            }
            className="flex w-full items-center justify-between gap-4 border-b border-black/[0.08] py-4 text-left transition-colors hover:text-black"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-black">
                Show prices incl. VAT
              </p>
              <p className="mt-0.5 text-[13px] text-black/35">
                Display tax-inclusive amounts where available.
              </p>
            </div>
            <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-black/25">
              {prefs.showPricesInclVat ? "On" : "Off"}
            </span>
          </button>
        </div>
      )}

      <p className="text-[14px] text-black/40">
        Marketing email toggles live under{" "}
        <Link
          href="/account/notifications"
          className="text-[13px] text-black/40 underline decoration-black/20 underline-offset-[5px] hover:text-black hover:decoration-black"
        >
          Notifications
        </Link>
        .
      </p>
    </div>
  );
}
