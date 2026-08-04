"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type Config = {
  configured: boolean;
  liveEnabled: boolean;
  secretMode: string;
  publicMode: string;
  publicKeyMasked: string;
  secretConfigured: boolean;
  webhookSecretConfigured: boolean;
  webhookHmacFallback: boolean;
  channels: string[];
};

type Health = {
  secretOk: boolean;
  publicOk: boolean;
  webhookOk: boolean;
  apiReachable: boolean;
  modeMismatch: boolean;
};

type Tx = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  paid_at?: string | null;
  created_at?: string;
  customer?: { email?: string };
  gateway_response?: string;
};

type Transfer = {
  id: number;
  transfer_code: string;
  amount: number;
  currency: string;
  status: string;
  reference?: string;
  reason?: string;
  created_at?: string;
  createdAt?: string;
  recipient?: { name?: string; recipient_code?: string };
};

type Intent = {
  public_id: string;
  amount_minor: number;
  status: string;
  email: string | null;
  paystack_reference: string | null;
  order_public_id: string | null;
  metadata?: { channel?: string } | null;
  created_at: string;
};

type Receipt = {
  public_id: string;
  amount_minor: number;
  channel: string | null;
  customer_email: string | null;
  paystack_reference: string | null;
  paid_at: string;
};

type Webhook = {
  event_id: string;
  event_type: string;
  processed: boolean;
  error: string | null;
  created_at: string;
};

type Payload = {
  config: Config;
  health: Health;
  paystackBalance: { currency: string; balance: number }[];
  paystackBalanceError: string | null;
  paystackTransactions: Tx[];
  paystackTransactionsError: string | null;
  paystackTransfers: Transfer[];
  paystackTransfersError: string | null;
  localBalances: { code: string; name: string; balanceMinor: number }[];
  paymentIntents: Intent[];
  receipts: Receipt[];
  webhooks: Webhook[];
};

function kesMinor(n: number) {
  return (n / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.12em]",
        ok ? "text-[var(--kc-trust)]" : "text-[#8e1b0d]",
      )}
    >
      {ok ? "●" : "○"} {label}
    </span>
  );
}

export default function AdminPaystackConsolePage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState("");
  const [refundAmt, setRefundAmt] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("https://your-domain.com");

  const load = () => {
    setLoading(true);
    return fetch("/api/admin/paystack")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok)
          throw new Error(j.error || "Failed to load Paystack console");
        setData(j.data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  async function runAction(action: "verify" | "sync_capture" | "refund") {
    if (!reference.trim()) {
      setActionMsg("Enter a Paystack reference");
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/admin/paystack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reference: reference.trim(),
          amountMinor: refundAmt ? Number(refundAmt) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setActionMsg(j.error || "Action failed");
        return;
      }
      if (action === "verify") {
        setActionMsg(
          `Verified · ${j.data.status} · ${kesMinor(j.data.amount)} ${j.data.currency || "KES"}`,
        );
      } else if (action === "sync_capture") {
        setActionMsg(
          j.data.already
            ? `Already captured · receipt ${j.data.receiptPublicId || " - "}`
            : `Captured · receipt ${j.data.receiptPublicId || " - "}`,
        );
      } else {
        setActionMsg("Refund submitted to Paystack");
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const config = data?.config;
  const health = data?.health;

  return (
    <AccessControl requiredPermission="payments:view">
      <PageContainer>
        <PageHeader
          title="Paystack"
          description="Live ops console - balance, transactions, webhooks, verify/capture, and refunds. Secrets stay server-side."
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className={adminUi.btnSecondary}
                disabled={loading}
              >
                Refresh
              </button>
              <Link href="/admin/finance" className={adminUi.btnGhost}>
                Ledger
              </Link>
              <Link href="/admin/settlements" className={adminUi.btnGhost}>
                Settlements
              </Link>
            </div>
          }
        />

        {error ? (
          <p className="mt-6 text-[13px] text-[#8e1b0d]">{error}</p>
        ) : null}

        {/* Health */}
        <section className="mt-8 space-y-4 border-b border-black/10 pb-8">
          <p className={adminUi.sectionLabel}>Connection</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Pill ok={Boolean(health?.secretOk)} label="Secret key" />
            <Pill ok={Boolean(health?.publicOk)} label="Public key" />
            <Pill ok={Boolean(health?.webhookOk)} label="Webhook HMAC" />
            <Pill ok={Boolean(health?.apiReachable)} label="API reachable" />
            {health?.modeMismatch ? (
              <Pill ok={false} label="Test/live key mismatch" />
            ) : null}
          </div>
          <div className="grid gap-3 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <span className="text-black/40">Mode</span> ·{" "}
              {config?.secretMode || " - "}
              {config?.liveEnabled ? " (live flag on)" : ""}
            </p>
            <p>
              <span className="text-black/40">Public key</span> ·{" "}
              <code className="text-[13px]">
                {config?.publicKeyMasked || " - "}
              </code>
            </p>
            <p>
              <span className="text-black/40">Channels</span> ·{" "}
              {(config?.channels || []).join(", ") || " - "}
            </p>
            <p className="sm:col-span-2 lg:col-span-3">
              <span className="text-black/40">Webhook URL</span> ·{" "}
              <code className="break-all text-[13px]">
                {origin}/api/webhooks/paystack
              </code>
            </p>
            {config?.webhookHmacFallback ? (
              <p className="text-[13px] text-black/45 sm:col-span-2 lg:col-span-3">
                PAYSTACK_WEBHOOK_SECRET unset - HMAC falls back to secret key.
              </p>
            ) : null}
          </div>
        </section>

        {/* Balances */}
        <section className="mt-8 border-b border-black/10 pb-8">
          <p className={adminUi.sectionLabel}>Balances</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(data?.paystackBalance || []).map((b) => (
              <div key={b.currency}>
                <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
                  Paystack · {b.currency}
                </p>
                <p className="mt-2 text-[22px] font-medium tracking-tight tabular-nums">
                  {kesMinor(b.balance)}
                </p>
              </div>
            ))}
            {(data?.localBalances || [])
              .filter((b) =>
                ["cash_paystack", "revenue_clearing", "platform_fees"].includes(
                  b.code,
                ),
              )
              .map((b) => (
                <div key={b.code}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
                    Ledger · {b.code}
                  </p>
                  <p className="mt-2 text-[22px] font-medium tracking-tight tabular-nums">
                    {kesMinor(b.balanceMinor)}
                  </p>
                </div>
              ))}
          </div>
          {data?.paystackBalanceError ? (
            <p className="mt-3 text-[13px] text-[#8e1b0d]">
              Paystack balance: {data.paystackBalanceError}
            </p>
          ) : null}
          {loading && !data ? (
            <p className="mt-3 text-[13px] text-black/40">Loading…</p>
          ) : null}
        </section>

        {/* Tools */}
        <section className="mt-8 border-b border-black/10 pb-8">
          <p className={adminUi.sectionLabel}>Reference tools</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-[11px] uppercase tracking-[0.14em] text-black/35">
                Paystack reference
              </span>
              <input
                className={adminUi.input}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="T… or your checkout reference"
              />
            </label>
            <label className="w-full sm:w-36">
              <span className="text-[11px] uppercase tracking-[0.14em] text-black/35">
                Refund minor
              </span>
              <input
                className={adminUi.input}
                value={refundAmt}
                onChange={(e) => setRefundAmt(e.target.value)}
                placeholder="optional"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction("verify")}
              className={adminUi.btnPrimary}
            >
              Verify
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction("sync_capture")}
              className={adminUi.btnSecondary}
            >
              Sync capture
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction("refund")}
              className={adminUi.btnSecondary}
            >
              Refund
            </button>
          </div>
          {actionMsg ? (
            <p className="mt-3 text-[13px] text-black/55">{actionMsg}</p>
          ) : null}
          <p className="mt-2 text-[12px] text-black/40">
            Sync capture re-runs ledger + receipt for a successful charge
            (idempotent). Refund posts a reversing ledger entry when amount
            minor is set.
          </p>
        </section>

        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <Section
            title="Paystack transactions"
            error={data?.paystackTransactionsError}
          >
            {(data?.paystackTransactions || []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReference(t.reference)}
                className="flex w-full items-start justify-between gap-3 border-b border-black/[0.06] py-3 text-left text-[13px] transition-colors hover:text-black"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.reference}</p>
                  <p className="mt-0.5 truncate text-black/40">
                    {t.customer?.email || " - "} · {t.channel || " - "} ·{" "}
                    {t.status}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p>
                    {kesMinor(t.amount)} {t.currency}
                  </p>
                  <p className="mt-0.5 text-[11px] text-black/35">
                    {(t.paid_at || t.created_at || "").slice(0, 10)}
                  </p>
                </div>
              </button>
            ))}
            {!data?.paystackTransactions?.length &&
            !data?.paystackTransactionsError ? (
              <p className="py-6 text-[13px] text-black/40">No transactions</p>
            ) : null}
          </Section>

          <Section
            title="Paystack transfers"
            error={data?.paystackTransfersError}
          >
            {(data?.paystackTransfers || []).map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 border-b border-black/[0.06] py-3 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {t.transfer_code || t.reference || t.id}
                  </p>
                  <p className="mt-0.5 truncate text-black/40">
                    {t.recipient?.name || t.recipient?.recipient_code || " - "}{" "}
                    · {t.status}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums">
                  {kesMinor(t.amount)} {t.currency}
                </p>
              </div>
            ))}
            {!data?.paystackTransfers?.length &&
            !data?.paystackTransfersError ? (
              <p className="py-6 text-[13px] text-black/40">No transfers</p>
            ) : null}
          </Section>

          <Section title="Local payment intents">
            {(data?.paymentIntents || []).map((p) => (
              <button
                key={p.public_id}
                type="button"
                onClick={() =>
                  p.paystack_reference && setReference(p.paystack_reference)
                }
                className="flex w-full items-start justify-between gap-3 border-b border-black/[0.06] py-3 text-left text-[13px]"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.public_id}</p>
                  <p className="mt-0.5 truncate text-black/40">
                    {p.email || " - "} · {p.status}
                    {p.paystack_reference ? ` · ${p.paystack_reference}` : ""}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums">
                  {kesMinor(p.amount_minor)}
                </p>
              </button>
            ))}
            {!data?.paymentIntents?.length ? (
              <p className="py-6 text-[13px] text-black/40">No intents yet</p>
            ) : null}
          </Section>

          <Section title="Receipts">
            {(data?.receipts || []).map((r) => (
              <div
                key={r.public_id}
                className="flex items-start justify-between gap-3 border-b border-black/[0.06] py-3 text-[13px]"
              >
                <div className="min-w-0">
                  <Link
                    href={`/r/${r.public_id}`}
                    className="font-medium hover:underline"
                  >
                    {r.public_id}
                  </Link>
                  <p className="mt-0.5 truncate text-black/40">
                    {r.customer_email || " - "} · {r.channel || " - "}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums">
                  {kesMinor(r.amount_minor)}
                </p>
              </div>
            ))}
            {!data?.receipts?.length ? (
              <p className="py-6 text-[13px] text-black/40">No receipts yet</p>
            ) : null}
          </Section>

          <Section title="Webhook events" className="lg:col-span-2">
            {(data?.webhooks || []).map((w) => (
              <div
                key={`${w.event_id}-${w.created_at}`}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-black/[0.06] py-3 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="font-medium">{w.event_type}</p>
                  <p className="mt-0.5 truncate text-black/40">{w.event_id}</p>
                  {w.error ? (
                    <p className="mt-0.5 text-[#8e1b0d]">{w.error}</p>
                  ) : null}
                </div>
                <div className="text-right text-black/40">
                  <p>{w.processed ? "processed" : "pending"}</p>
                  <p className="text-[11px]">{w.created_at?.slice(0, 19)}</p>
                </div>
              </div>
            ))}
            {!data?.webhooks?.length ? (
              <p className="py-6 text-[13px] text-black/40">
                No Paystack webhooks logged yet. Point Dashboard → Webhooks at
                this URL for charge.success.
              </p>
            ) : null}
          </Section>
        </div>
      </PageContainer>
    </AccessControl>
  );
}

function Section({
  title,
  error,
  children,
  className,
}: {
  title: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className={adminUi.sectionLabel}>{title}</p>
      {error ? (
        <p className="mt-2 text-[13px] text-[#8e1b0d]">{error}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}
