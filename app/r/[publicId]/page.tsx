"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatPrice } from "@/lib/currency";

/** Printable public receipt view (same API; requires auth for now). */
export default function PublicReceiptPage() {
  const params = useParams();
  const id = String(params?.publicId || "");
  const [receipt, setReceipt] = useState<{
    public_id: string;
    amount_minor: number;
    channel: string | null;
    paystack_reference: string;
    paid_at: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/receipts/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Not found");
        setReceipt(j.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[14px] text-black/50">{error}</p>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
          Loading
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f7f7f5] px-6 py-16">
      <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
        Online receipt
      </p>
      <h1 className="mt-2 text-[28px] font-medium">klikcollect</h1>
      <p className="mt-8 text-[32px] font-medium tracking-tight">
        {formatPrice(receipt.amount_minor / 100)}
      </p>
      <p className="mt-2 text-[13px] text-black/45">
        {receipt.channel} · {receipt.paystack_reference}
      </p>
      <p className="mt-1 text-[12px] text-black/35">
        {new Date(receipt.paid_at).toLocaleString()}
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-10 bg-black px-5 py-3 text-[12px] uppercase tracking-wider text-white print:hidden"
      >
        Print
      </button>
    </div>
  );
}
