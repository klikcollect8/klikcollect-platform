"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/os/ModuleShell";
import { osUi } from "@/components/os/os-ui";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { majorToMinor } from "@/lib/money";

type Settlement = {
  public_id: string;
  net_minor: number;
  status: string;
};
type Payout = {
  public_id: string;
  amount_minor: number;
  status: string;
};
type Receipt = {
  public_id: string;
  amount_minor: number;
  channel: string | null;
  order_public_id?: string | null;
};
type Recipient = {
  recipient_code: string;
  name: string | null;
  type: string;
};
type LedgerTx = {
  public_id: string;
  transaction_type: string;
  reference_type?: string | null;
  created_at: string;
  amount_minor?: number;
};

function kes(minor: number) {
  return (minor / 100).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function FinancePage() {
  const [refundOrder, setRefundOrder] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState("");
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [availableMinor, setAvailableMinor] = useState(0);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [transactions, setTransactions] = useState<LedgerTx[]>([]);
  const [amountKes, setAmountKes] = useState("500");
  const [msg, setMsg] = useState<string | null>(null);
  const [rcptName, setRcptName] = useState("");
  const [rcptAccount, setRcptAccount] = useState("");
  const [rcptBank, setRcptBank] = useState("MPESA");
  const [rcptType, setRcptType] = useState("mobile_money");
  const [refundInfo, setRefundInfo] = useState<{
    id: string;
    orderNumber: string;
    totalMinor: number;
    customerName: string;
  } | null>(null);

  const load = (vid: string) =>
    void fetch(`/api/os/finance?vendorId=${encodeURIComponent(vid)}`)
      .then((r) => r.json())
      .then((j) => {
        setSettlements(j.data?.settlements || []);
        setPayouts(j.data?.payouts || []);
        setReceipts(j.data?.receipts || []);
        setRecipients(j.data?.recipients || []);
        setTransactions(j.data?.transactions || []);
        setAvailableMinor(Number(j.data?.availableMinor || 0));
        setCanWithdraw(!!j.data?.canWithdraw);
      });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setRefundOrder(q.get("refundOrder"));
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const id = b?.data?.vendorIds?.[0] || "";
        setVendorId(id);
        if (id) load(id);
      });
  }, []);

  useEffect(() => {
    if (!refundOrder) {
      setRefundInfo(null);
      return;
    }
    void fetch("/api/os/orders")
      .then((r) => r.json())
      .then((j) => {
        const orders = (j.data || []) as Array<{
          id: string;
          orderNumber: string;
          totalMinor: number;
          customerName: string;
        }>;
        const o = orders.find(
          (x) => x.id === refundOrder || x.orderNumber === refundOrder,
        );
        setRefundInfo(o || null);
      });
  }, [refundOrder]);

  const pendingMinor = useMemo(
    () =>
      payouts
        .filter((p) => p.status === "pending" || p.status === "queued")
        .reduce((s, p) => s + Number(p.amount_minor || 0), 0),
    [payouts],
  );

  const heldMinor = useMemo(
    () =>
      payouts
        .filter(
          (p) =>
            p.status === "held" ||
            p.status === "processing" ||
            p.status === "in_transit",
        )
        .reduce((s, p) => s + Number(p.amount_minor || 0), 0),
    [payouts],
  );

  const nextPayout = useMemo(() => {
    const open = payouts.filter(
      (p) =>
        p.status === "pending" ||
        p.status === "queued" ||
        p.status === "processing",
    );
    return open[0] || null;
  }, [payouts]);

  const withdraw = async () => {
    setMsg(null);
    const major = Number(amountKes);
    if (!Number.isFinite(major) || major <= 0) {
      setMsg("Enter a valid amount in KES");
      return;
    }
    const amountMinor = majorToMinor(major);
    const res = await fetch("/api/os/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId, amountMinor }),
    });
    const j = await res.json();
    setMsg(
      res.ok
        ? `Withdrawal requested · ${kes(amountMinor)} KES`
        : j.error?.message || "Failed",
    );
    load(vendorId);
  };

  const registerRecipient = async () => {
    setMsg(null);
    const res = await fetch("/api/os/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register_recipient",
        vendorId,
        name: rcptName,
        accountNumber: rcptAccount,
        bankCode: rcptBank,
        type: rcptType,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? "Recipient registered" : j.error?.message || "Failed");
    load(vendorId);
  };

  const exportCsv = () => {
    const lines = [
      "type,public_id,amount_kes,status_or_channel",
      ...settlements.map(
        (s) =>
          `settlement,${s.public_id},${(s.net_minor / 100).toFixed(2)},${s.status}`,
      ),
      ...payouts.map(
        (p) =>
          `payout,${p.public_id},${(p.amount_minor / 100).toFixed(2)},${p.status}`,
      ),
      ...receipts.map(
        (r) =>
          `receipt,${r.public_id},${(r.amount_minor / 100).toFixed(2)},${r.channel || ""}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallet-${vendorId || "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModuleShell
      title="Wallet"
      description="Available balance, pending payouts, held funds, and settlement history."
      live
      actions={
        <button type="button" onClick={exportCsv} className={osUi.btnSecondary}>
          Export CSV
        </button>
      }
    >
      <div className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Available" value={`${kes(availableMinor)} KES`} />
          <Stat label="Pending" value={`${kes(pendingMinor)} KES`} />
          <Stat label="Held" value={`${kes(heldMinor)} KES`} />
          <Stat
            label="Next payout"
            value={
              nextPayout
                ? `${kes(nextPayout.amount_minor)} · ${nextPayout.status}`
                : "None queued"
            }
          />
        </div>

        {refundOrder ? (
          <div className="border-b border-black/10 pb-6">
            <p className={osUi.sectionLabel}>Refund from orders</p>
            {refundInfo ? (
              <p className="mt-2 text-[14px] text-black">
                {refundInfo.orderNumber} · {refundInfo.customerName} ·{" "}
                {kes(refundInfo.totalMinor)} KES
              </p>
            ) : (
              <p className={cn("mt-2 text-[14px]", osUi.muted)}>
                Order {refundOrder}
              </p>
            )}
            <p className={cn("mt-2 text-[13px]", osUi.muted)}>
              Marketplace Paystack refunds are run from Admin → Paystack
              (platform finance). For POS returns, restock from Inventory and
              note the customer in CRM.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/app/orders" className={osUi.btnSecondary}>
                Back to orders
              </Link>
              <Link href="/app/inventory" className={osUi.btnGhost}>
                Inventory
              </Link>
            </div>
          </div>
        ) : null}

        {canWithdraw ? (
          <div className="flex flex-col gap-3 border-b border-black/10 pb-6 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className={osUi.sectionLabel}>Withdraw (KES)</span>
              <input
                className={osUi.input}
                value={amountKes}
                onChange={(e) => setAmountKes(e.target.value)}
                placeholder="e.g. 500.00"
                inputMode="decimal"
              />
            </label>
            <button
              type="button"
              onClick={() => void withdraw()}
              className={osUi.btnPrimary}
            >
              Request withdrawal
            </button>
          </div>
        ) : (
          <p className={cn("text-[13px]", osUi.muted)}>
            Withdrawals require Vendor Owner or Finance Manager.
          </p>
        )}

        <div>
          <p className={osUi.sectionLabel}>Payout recipient (M-Pesa / bank)</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className={osUi.input}
              placeholder="Account name"
              value={rcptName}
              onChange={(e) => setRcptName(e.target.value)}
            />
            <input
              className={osUi.input}
              placeholder="Phone / account number"
              value={rcptAccount}
              onChange={(e) => setRcptAccount(e.target.value)}
            />
            <input
              className={osUi.input}
              placeholder="Bank code (e.g. MPESA)"
              value={rcptBank}
              onChange={(e) => setRcptBank(e.target.value)}
            />
            <select
              className={cn(osUi.input, "bg-transparent")}
              value={rcptType}
              onChange={(e) => setRcptType(e.target.value)}
            >
              <option value="mobile_money">mobile_money</option>
              <option value="nuban">nuban</option>
              <option value="basa">basa</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void registerRecipient()}
            className={cn(osUi.btnSecondary, "mt-4")}
          >
            Register recipient
          </button>
          <div className="mt-4 divide-y divide-black/[0.06]">
            {recipients.map((r) => (
              <p key={r.recipient_code} className="py-2 text-[13px]">
                {r.name} · {r.type} · <code>{r.recipient_code}</code>
              </p>
            ))}
          </div>
        </div>

        {msg ? <p className={cn("text-[13px]", osUi.muted)}>{msg}</p> : null}

        <div className="grid gap-8 lg:grid-cols-2">
          <List
            title="Settlements"
            rows={settlements.map(
              (s) => `${s.public_id} · ${kes(s.net_minor)} · ${s.status}`,
            )}
          />
          <List
            title="Payouts"
            rows={payouts.map(
              (p) => `${p.public_id} · ${kes(p.amount_minor)} · ${p.status}`,
            )}
          />
        </div>

        <div>
          <p className={cn("border-b border-black/10 pb-3", osUi.sectionLabel)}>
            Ledger statement
          </p>
          {transactions.map((t) => (
            <div
              key={t.public_id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/[0.06] py-3 text-[13px]"
            >
              <div className="min-w-0">
                <p className="font-medium text-black">{t.public_id}</p>
                <p className={osUi.muted}>
                  {t.transaction_type}
                  {t.reference_type ? ` · ${t.reference_type}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular-nums">
                  {typeof t.amount_minor === "number"
                    ? `${kes(t.amount_minor)} KES`
                    : " - "}
                </p>
                <p className={cn("text-[11px]", osUi.muted)}>
                  {String(t.created_at || "").slice(0, 10)}
                </p>
              </div>
            </div>
          ))}
          {!transactions.length ? (
            <p className={cn("py-6 text-center", osUi.muted)}>
              No ledger movements for this store yet
            </p>
          ) : null}
        </div>

        <div>
          <p className={cn("border-b border-black/10 pb-3", osUi.sectionLabel)}>
            Recent receipts
          </p>
          {receipts.map((r) => (
            <div
              key={r.public_id}
              className="flex justify-between border-b border-black/[0.06] py-3 text-[13px]"
            >
              <Link href={`/r/${r.public_id}`} className="underline">
                {r.public_id}
              </Link>
              <span>{kes(r.amount_minor)} KES</span>
              <span className={osUi.muted}>{r.channel || " - "}</span>
            </div>
          ))}
          {!receipts.length ? (
            <p className={cn("py-6 text-center", osUi.muted)}>Empty</p>
          ) : null}
        </div>
      </div>
    </ModuleShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={osUi.sectionLabel}>{label}</p>
      <p className="mt-2 text-[22px] font-medium tracking-tight text-black">
        {value}
      </p>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <p className={cn("border-b border-black/10 pb-3", osUi.sectionLabel)}>
        {title}
      </p>
      {rows.map((r, i) => (
        <p
          key={i}
          className="border-b border-black/[0.06] py-3 text-[13px] text-black"
        >
          {r}
        </p>
      ))}
      {!rows.length ? (
        <p className={cn("py-6 text-center", osUi.muted)}>Empty</p>
      ) : null}
    </div>
  );
}
