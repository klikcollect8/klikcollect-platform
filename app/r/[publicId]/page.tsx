"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  order_public_id?: string | null;
};

/** Mobile-first printable pickup receipt. */
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
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#f7f7f5] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] text-center sm:px-6">
        <p className="max-w-sm text-[15px] text-black/55">{error}</p>
        <p className="max-w-sm text-[13px] text-black/35">
          Payment receipts require a signed-in account.
        </p>
        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center justify-center bg-black px-6 text-[12px] font-medium uppercase tracking-[0.14em] text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f5] px-4">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
          Loading
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-md bg-[#f7f7f5] px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pt-12">
      <div className="print:hidden mb-6 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
          Pickup receipt
        </p>
        <h1 className="text-[clamp(1.35rem,5vw,1.75rem)] font-medium tracking-tight text-black">
          Show this at the shop
        </h1>
        <p className="text-[14px] leading-relaxed text-black/45">
          When your order is ready, present this receipt (or a printout) for
          click &amp; collect.
        </p>
      </div>

      <div className="overflow-x-auto">
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
      </div>

      <p className="mt-4 break-all text-[11px] text-black/35 print:hidden">
        Ref · {receipt.paystack_reference}
      </p>

      <div className="print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[#f7f7f5]/95 px-4 py-3 backdrop-blur-md pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => printSheet()}
            className="inline-flex min-h-12 w-full items-center justify-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white"
          >
            Print receipt
          </button>
          <Link
            href="/account/orders"
            className="inline-flex min-h-12 w-full items-center justify-center border border-black/15 px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-black"
          >
            My orders
          </Link>
        </div>
      </div>
    </div>
  );
}
