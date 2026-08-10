"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/currency";

type Receipt = {
  public_id: string;
  order_public_id: string | null;
  paystack_reference: string;
  customer_email: string | null;
  amount_minor: number;
  channel: string | null;
  paid_at: string;
  line_items: unknown[];
};

export default function AccountReceiptPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/receipts/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        setReceipt(j.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-16">
        <p className="text-[15px] text-red-600">{error}</p>
        <Link
          href="/account/orders"
          className="mt-4 inline-flex min-h-11 items-center text-[13px] underline"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
          Loading
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-16 print:py-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
        Pickup receipt
      </p>
      <h1 className="mt-2 text-[clamp(1.5rem,6vw,1.75rem)] font-medium tracking-tight">
        Show at the shop
      </h1>
      <p className="mt-1 break-all text-[13px] text-black/45">
        {receipt.public_id}
      </p>

      <div className="mt-8 space-y-3 border-t border-black/10 pt-6 text-[14px] sm:mt-10">
        <Row label="Amount" value={formatPrice(receipt.amount_minor / 100)} />
        <Row label="Channel" value={receipt.channel || " - "} />
        <Row
          label="Reference"
          value={receipt.paystack_reference}
          breakAll
        />
        <Row label="Order" value={receipt.order_public_id || " - "} />
        <Row label="Email" value={receipt.customer_email || " - "} />
        <Row label="Paid" value={new Date(receipt.paid_at).toLocaleString()} />
      </div>

      <div className="mt-8 flex flex-col gap-3 print:hidden sm:mt-10 sm:flex-row sm:gap-4">
        <Link
          href={`/r/${encodeURIComponent(receipt.public_id)}`}
          className="inline-flex min-h-12 w-full items-center justify-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white sm:w-auto"
        >
          Full receipt
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-12 w-full items-center justify-center border border-black/15 px-5 text-[12px] font-medium uppercase tracking-[0.14em] sm:w-auto"
        >
          Print
        </button>
        <Link
          href="/account/orders"
          className="inline-flex min-h-12 w-full items-center justify-center border border-black/15 px-5 text-[12px] font-medium uppercase tracking-[0.14em] sm:w-auto"
        >
          Orders
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  breakAll,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-black/40">{label}</span>
      <span
        className={`max-w-[65%] text-right font-medium ${breakAll ? "break-all" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
