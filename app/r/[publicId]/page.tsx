"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PrintSheet, printSheet } from "@/components/os/PrintSheet";

type ReceiptView = {
  public_id: string;
  amount_minor: number;
  channel: string | null;
  paystack_reference: string;
  paid_at: string;
  vendor_name?: string | null;
  vendor_public_id?: string | null;
  lines?: Array<{ name: string; quantity: number; moneyMinor?: number }>;
  auth_required?: boolean;
};

/** Printable receipt view — requires sign-in (owner or platform staff). */
export default function PublicReceiptPage() {
  const params = useParams();
  const id = String(params?.publicId || "");
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/receipts/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json();
        if (r.status === 401) {
          throw new Error("Sign in to view this receipt");
        }
        if (!r.ok) throw new Error(j.error || "Not found");
        setReceipt(j.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f7f7f5] px-6">
        <p className="text-[14px] text-black/50">{error}</p>
        <p className="text-[12px] text-black/35">
          Payment receipts require a signed-in account.
        </p>
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
      <PrintSheet
        template="payment"
        vendorName={receipt.vendor_name || "KlikCollect"}
        receiptCode={receipt.public_id}
        channel={receipt.channel || undefined}
        reference={receipt.paystack_reference}
        totalMinor={receipt.amount_minor}
        paidAt={receipt.paid_at}
        lines={receipt.lines || []}
      />
      <button
        type="button"
        onClick={() => printSheet()}
        className="mt-10 bg-black px-5 py-3 text-[12px] uppercase tracking-wider text-white print:hidden"
      >
        Print
      </button>
    </div>
  );
}
