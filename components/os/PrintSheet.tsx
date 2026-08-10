"use client";

import { formatKesMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

export type PrintLine = {
  name: string;
  quantity: number;
  moneyMinor?: number;
  barcode?: string;
};

export type PrintSheetProps = {
  template: "packing" | "pos" | "payment";
  vendorName?: string;
  receiptCode?: string;
  customerName?: string;
  notes?: string;
  tender?: string;
  channel?: string;
  reference?: string;
  totalMinor?: number;
  lines?: PrintLine[];
  paidAt?: string;
  className?: string;
  /** When true, only visible under @media print */
  printOnly?: boolean;
};

/**
 * Shared browser print surface for packing slips, POS, and payment receipts.
 */
export function PrintSheet({
  template,
  vendorName = "Store",
  receiptCode,
  customerName,
  notes,
  tender,
  channel,
  reference,
  totalMinor,
  lines = [],
  paidAt,
  className,
  printOnly = false,
}: PrintSheetProps) {
  const title =
    template === "packing"
      ? "Packing slip"
      : template === "pos"
        ? "POS receipt"
        : "Payment receipt";

  return (
    <div
      className={cn(
        "print-sheet space-y-4 text-black",
        printOnly ? "hidden print:block" : "block",
        className,
      )}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-sheet, .print-sheet * { visibility: visible !important; }
          .print-sheet {
            position: absolute !important;
            left: 0; top: 0; width: 100%;
            padding: 24px;
          }
        }
      `}</style>
      <p className="text-[11px] uppercase tracking-[0.16em] text-black/40">
        KlikCollect · {title}
      </p>
      <h2 className="text-[22px] font-medium tracking-tight">{vendorName}</h2>
      {receiptCode ? (
        <p className="text-[18px] font-semibold tracking-tight">{receiptCode}</p>
      ) : null}
      {customerName ? (
        <p className="text-[14px]">
          {customerName}
          {notes ? ` · ${notes}` : ""}
        </p>
      ) : notes ? (
        <p className="text-[14px]">{notes}</p>
      ) : null}
      {tender ? (
        <p className="text-[13px] capitalize text-black/55">Paid · {tender}</p>
      ) : null}
      {channel || reference ? (
        <p className="text-[13px] text-black/55">
          {[channel, reference].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="text-[12px] text-black/40">
        {paidAt
          ? new Date(paidAt).toLocaleString("en-KE")
          : new Date().toLocaleString("en-KE")}
      </p>

      {lines.length ? (
        <ul className="mt-2 divide-y divide-black/15 border-y border-black/15">
          {lines.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <div>
                <p className="text-[15px] font-medium">
                  {it.quantity}× {it.name}
                </p>
                {it.barcode ? (
                  <p className="mt-0.5 font-mono text-[12px] tracking-wider text-black/50">
                    {it.barcode}
                  </p>
                ) : null}
              </div>
              {typeof it.moneyMinor === "number" ? (
                <span className="tabular-nums text-[14px]">
                  {formatKesMinor(it.moneyMinor * it.quantity)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {typeof totalMinor === "number" ? (
        <p className="flex justify-between border-t border-black/15 pt-3 text-[16px] font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatKesMinor(totalMinor)}</span>
        </p>
      ) : null}

      <p className="pt-4 text-[11px] text-black/35">
        Thank you · Powered by KlikCollect
      </p>
    </div>
  );
}

export function printSheet() {
  if (typeof window !== "undefined") window.print();
}
