"use client";

import { useCallback, useEffect, useState } from "react";
import { ModuleShell } from "@/components/os/ModuleShell";
import { osUi } from "@/components/os/os-ui";

type ConnectState = {
  config?: { configured?: boolean; currency?: string };
  publishableKey?: string | null;
  connected?: {
    stripe_account_id: string;
    transfers_ready: boolean;
    details_submitted: boolean;
  } | null;
};

/**
 * Stripe Connect embedded onboarding (Accounts v2, dashboard: none).
 * Loads Connect.js dynamically when starting a session.
 */
export default function VendorPaymentsPage() {
  const [state, setState] = useState<ConnectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/os/stripe/connect");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load Stripe Connect");
      setState(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startOnboarding = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/os/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "session" }),
      });
      const j = await res.json();
      if (!res.ok || !j.data?.clientSecret) {
        throw new Error(j.error || "Could not create account session");
      }

      const pk = j.data.publishableKey || state?.publishableKey;
      if (!pk) throw new Error("Missing Stripe publishable key");

      // Dynamic import — keep bundle lean until vendor opens payments
      const { loadConnectAndInitialize } = await import(
        "@stripe/connect-js/pure"
      );

      const instance = loadConnectAndInitialize({
        publishableKey: pk,
        fetchClientSecret: async () => j.data.clientSecret,
      });

      if (!mountEl) throw new Error("Mount node missing");
      mountEl.innerHTML = "";
      const onboarding = instance.create("account-onboarding");
      mountEl.appendChild(onboarding);

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setStarting(false);
    }
  };

  return (
    <ModuleShell
      title="Payouts"
      description="Connect Stripe to receive transfers after customer pickup."
      live
    >
      <div className="space-y-6">
        {loading ? (
          <p className={osUi.muted}>Loading…</p>
        ) : (
          <>
            <div className="border border-[var(--kc-border)] px-5 py-4">
              <p className={osUi.sectionLabel}>Stripe Connect</p>
              <p className="mt-2 text-[14px]">
                {state?.config?.configured
                  ? `Ready · currency ${state.config.currency || "kes"}`
                  : "Stripe keys not configured on the server"}
              </p>
              {state?.connected ? (
                <div className="mt-3 space-y-1 text-[13px] text-[var(--kc-muted)]">
                  <p>Account: {state.connected.stripe_account_id}</p>
                  <p>
                    Transfers:{" "}
                    {state.connected.transfers_ready
                      ? "active"
                      : "pending onboarding"}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-[var(--kc-muted)]">
                  No connected account yet. Start onboarding to get paid.
                </p>
              )}
              <button
                type="button"
                onClick={() => void startOnboarding()}
                disabled={starting || !state?.config?.configured}
                className="mt-4 bg-black px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
              >
                {starting
                  ? "Starting…"
                  : state?.connected
                    ? "Continue onboarding"
                    : "Start Stripe onboarding"}
              </button>
            </div>

            <div
              ref={setMountEl}
              className="min-h-[120px] border border-[var(--kc-border)] px-3 py-3"
            />

            {error ? (
              <p className="text-[13px] text-red-600">{error}</p>
            ) : null}

            <p className="text-[12px] text-[var(--kc-muted)]">
              Funds are held on KlikCollect until the order is marked collected,
              then transferred to your Stripe balance (separate charges &amp;
              transfers).
            </p>
          </>
        )}
      </div>
    </ModuleShell>
  );
}
