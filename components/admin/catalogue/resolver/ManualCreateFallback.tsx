"use client";

import { adminUi } from "@/components/admin/admin-ui";

type Props = {
  barcode: string;
  format?: string;
  message?: string;
  onContinue: () => void;
  onScanAnother?: () => void;
};

/** Shown when barcode is valid but no provider returned product data. */
export default function ManualCreateFallback({
  barcode,
  format,
  message,
  onContinue,
  onScanAnother,
}: Props) {
  return (
    <div className="space-y-3 border border-dashed border-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
        Manual create
      </p>
      <h3 className="text-[18px] font-medium text-black">
        No external product data
      </h3>
      <p className="text-[13px] text-black/55">
        {message ||
          "This barcode is not in Open Food Facts / Open Products Facts. Enter details manually — the product will stay pending review."}
      </p>
      <p className="text-[13px] text-black/45">
        {format ? `${format.replace("_", "-")} · ` : ""}
        {barcode}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className={adminUi.btnPrimary} onClick={onContinue}>
          Create manually
        </button>
        {onScanAnother ? (
          <button
            type="button"
            className={adminUi.btnGhost}
            onClick={onScanAnother}
          >
            Scan another
          </button>
        ) : null}
      </div>
    </div>
  );
}
