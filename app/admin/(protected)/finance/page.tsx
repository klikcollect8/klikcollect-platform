"use client";

import { useEffect, useState } from "react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import Link from "next/link";

type FinancePayload = {
  balances: { code: string; name: string; balanceMinor: number }[];
  transactions: {
    public_id: string;
    transaction_type: string;
    created_at: string;
  }[];
  settlements: {
    public_id: string;
    vendor_public_id: string;
    net_minor: number;
    status: string;
  }[];
  payouts: {
    public_id: string;
    vendor_public_id: string;
    amount_minor: number;
    status: string;
  }[];
  paymentIntents: {
    public_id: string;
    amount_minor: number;
    status: string;
    email: string | null;
  }[];
  receipts: {
    public_id: string;
    amount_minor: number;
    channel: string | null;
    paid_at: string;
  }[];
  webhooks: {
    event_type: string;
    processed: boolean;
    error: string | null;
    created_at: string;
  }[];
};

export default function AdminFinancePage() {
  const [data, setData] = useState<FinancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refundRef, setRefundRef] = useState("");
  const [refundAmt, setRefundAmt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = () =>
    void fetch("/api/admin/finance")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        setData(j.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));

  useEffect(() => {
    load();
  }, []);

  const refund = async () => {
    setMsg(null);
    const res = await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refund",
        reference: refundRef,
        amountMinor: refundAmt ? Number(refundAmt) : undefined,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? "Refund submitted" : j.error || "Refund failed");
    load();
  };

  return (
    <AccessControl requiredPermission="ledger:view">
      <PageContainer>
        <PageHeader
          title="Finance & Ledger"
          description="Balances, append-only ledger, intents, receipts, and refunds."
        />
        {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(data?.balances || []).map((b) => (
            <div
              key={b.code}
              className="border border-black/10 bg-white px-4 py-4"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-black/35">
                {b.code}
              </p>
              <p className="mt-2 text-[20px] font-medium tracking-tight">
                {(b.balanceMinor / 100).toLocaleString("en-KE", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="mt-1 text-[12px] text-black/40">KES</p>
            </div>
          ))}
          {!data?.balances?.length ? (
            <p className="text-[13px] text-black/40">No balance rows yet</p>
          ) : null}
        </div>

        <div className="mt-8 border border-black/10 bg-white p-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
            Refund
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 border-b border-black/15 py-2 outline-none"
              placeholder="Paystack reference"
              value={refundRef}
              onChange={(e) => setRefundRef(e.target.value)}
            />
            <input
              className="w-40 border-b border-black/15 py-2 outline-none"
              placeholder="amount minor"
              value={refundAmt}
              onChange={(e) => setRefundAmt(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void refund()}
              className="bg-black px-4 py-2 text-[12px] uppercase tracking-wider text-white"
            >
              Refund
            </button>
          </div>
          {msg ? <p className="mt-2 text-[13px] text-black/55">{msg}</p> : null}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Section title="Ledger transactions">
            {(data?.transactions || []).map((t) => (
              <Row
                key={t.public_id}
                a={t.public_id}
                b={t.transaction_type}
                c={t.created_at.slice(0, 10)}
              />
            ))}
          </Section>
          <Section title="Payment intents">
            {(data?.paymentIntents || []).map((p) => (
              <Row
                key={p.public_id}
                a={p.public_id}
                b={`${(p.amount_minor / 100).toFixed(2)} KES`}
                c={p.status}
              />
            ))}
          </Section>
          <Section title="Receipts">
            {(data?.receipts || []).map((r) => (
              <div
                key={r.public_id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"
              >
                <Link
                  href={`/account/receipts/${r.public_id}`}
                  className="truncate font-medium underline"
                >
                  {r.public_id}
                </Link>
                <span className="text-black/50">
                  {(r.amount_minor / 100).toFixed(2)} KES
                </span>
                <span className="shrink-0 text-black/40">
                  {r.channel || " - "}
                </span>
              </div>
            ))}
          </Section>
          <Section title="Webhooks">
            {(data?.webhooks || []).map((w, i) => (
              <Row
                key={`${w.event_type}-${i}`}
                a={w.event_type}
                b={w.processed ? "ok" : "pending"}
                c={w.error || w.created_at.slice(0, 10)}
              />
            ))}
          </Section>
          <Section title="Settlements">
            {(data?.settlements || []).map((s) => (
              <Row
                key={s.public_id}
                a={s.vendor_public_id}
                b={`${(s.net_minor / 100).toFixed(2)} KES`}
                c={s.status}
              />
            ))}
          </Section>
          <Section title="Payouts">
            {(data?.payouts || []).map((p) => (
              <Row
                key={p.public_id}
                a={p.vendor_public_id}
                b={`${(p.amount_minor / 100).toFixed(2)} KES`}
                c={p.status}
              />
            ))}
          </Section>
        </div>
      </PageContainer>
    </AccessControl>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-black/10 bg-white">
      <p className="border-b border-black/10 px-4 py-3 text-[11px] uppercase tracking-[0.14em] text-black/40">
        {title}
      </p>
      <div className="divide-y divide-black/[0.06]">{children}</div>
    </div>
  );
}

function Row({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
      <span className="truncate font-medium">{a}</span>
      <span className="text-black/50">{b}</span>
      <span className="shrink-0 text-black/40">{c}</span>
    </div>
  );
}
