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
      <div className="mx-auto max-w-lg px-6 py-16">
        <p className="text-[14px] text-red-600">{error}</p>
        <Link
          href="/account/orders"
          className="mt-4 inline-block text-[13px] underline"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
          Loading
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16 print:py-8">
      <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
        Receipt
      </p>
      <h1 className="mt-2 text-[28px] font-medium tracking-tight">
        klikcollect
      </h1>
      <p className="mt-1 text-[14px] text-black/50">{receipt.public_id}</p>

      <div className="mt-10 space-y-3 border-t border-black/10 pt-6 text-[14px]">
        <Row label="Amount" value={formatPrice(receipt.amount_minor / 100)} />
        <Row label="Channel" value={receipt.channel || " - "} />
        <Row label="Reference" value={receipt.paystack_reference} />
        <Row label="Order" value={receipt.order_public_id || " - "} />
        <Row label="Email" value={receipt.customer_email || " - "} />
        <Row label="Paid" value={new Date(receipt.paid_at).toLocaleString()} />
      </div>

      <div className="mt-10 flex gap-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-black px-5 py-3 text-[12px] uppercase tracking-wider text-white"
        >
          Print
        </button>
        <Link
          href="/account/orders"
          className="border border-black/15 px-5 py-3 text-[12px] uppercase tracking-wider"
        >
          Orders
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-black/40">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
