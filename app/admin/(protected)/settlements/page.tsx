"use client";

import { useEffect, useState } from "react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<
    {
      public_id: string;
      vendor_public_id: string;
      net_minor: number;
      status: string;
    }[]
  >([]);
  const [vendorPublicId, setVendorPublicId] = useState("");
  const [netMinor, setNetMinor] = useState("");
  const [recipientCode, setRecipientCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const reload = () =>
    void fetch("/api/admin/finance")
      .then((r) => r.json())
      .then((j) => setSettlements(j.data?.settlements || []));

  useEffect(() => {
    reload();
  }, []);

  const createFromBalance = async () => {
    setMsg(null);
    const res = await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_settlement_from_balance",
        vendorPublicId,
        netMinor: netMinor ? Number(netMinor) : undefined,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? "Settlement from balance created" : j.error || "Failed");
    reload();
  };

  const create = async () => {
    setMsg(null);
    const res = await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_settlement",
        vendorPublicId,
        netMinor: Number(netMinor),
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? "Settlement created" : j.error || "Failed");
    reload();
  };

  const payout = async () => {
    setMsg(null);
    const res = await fetch("/api/admin/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "trigger_payout",
        vendorPublicId,
        amountMinor: Number(netMinor),
        recipientCode,
      }),
    });
    const j = await res.json();
    setMsg(
      res.ok
        ? recipientCode
          ? "Paystack transfer executed"
          : "Payout queued (no recipient)"
        : j.error || "Failed",
    );
    reload();
  };

  return (
    <AccessControl requiredPermission="finance:settlements">
      <PageContainer>
        <PageHeader
          title="Settlements & Payouts"
          description="Net vendor payable from ledger, then transfer via Paystack recipient code."
        />
        <div className="mt-8 space-y-4 border border-black/10 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 border-b border-black/15 py-2 outline-none"
              placeholder="vendor public id"
              value={vendorPublicId}
              onChange={(e) => setVendorPublicId(e.target.value)}
            />
            <input
              className="w-40 border-b border-black/15 py-2 outline-none"
              placeholder="amount minor"
              value={netMinor}
              onChange={(e) => setNetMinor(e.target.value)}
            />
          </div>
          <input
            className="w-full border-b border-black/15 py-2 outline-none"
            placeholder="Paystack recipient_code (RCP_…)"
            value={recipientCode}
            onChange={(e) => setRecipientCode(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void createFromBalance()}
              className="bg-black px-4 py-2 text-[12px] uppercase tracking-wider text-white"
            >
              Settle from balance
            </button>
            <button
              type="button"
              onClick={() => void create()}
              className="border border-black px-4 py-2 text-[12px] uppercase tracking-wider"
            >
              Manual settlement
            </button>
            <button
              type="button"
              onClick={() => void payout()}
              className="border border-black px-4 py-2 text-[12px] uppercase tracking-wider"
            >
              Execute payout
            </button>
          </div>
          {msg ? <p className="text-[13px] text-black/60">{msg}</p> : null}
        </div>
        <div className="mt-6 divide-y divide-black/[0.06] border border-black/10 bg-white">
          {settlements.map((s) => (
            <div
              key={s.public_id}
              className="flex justify-between px-4 py-3 text-[13px]"
            >
              <span>{s.public_id}</span>
              <span>{s.vendor_public_id}</span>
              <span>{(s.net_minor / 100).toFixed(2)} KES</span>
              <span className="text-black/40">{s.status}</span>
            </div>
          ))}
          {!settlements.length ? (
            <p className="px-4 py-8 text-center text-black/40">
              No settlements yet
            </p>
          ) : null}
        </div>
      </PageContainer>
    </AccessControl>
  );
}
