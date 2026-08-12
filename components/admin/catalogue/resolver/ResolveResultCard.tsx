"use client";

import Link from "next/link";
import { adminUi } from "@/components/admin/admin-ui";
import type { LocalProductHit, ResolveResult } from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

type Props = {
  result: ResolveResult;
  onContinueReview?: () => void;
  onScanAnother?: () => void;
};

/** Compact summary: existing catalogue hit vs external candidate. */
export default function ResolveResultCard({
  result,
  onContinueReview,
  onScanAnother,
}: Props) {
  if (result.localProduct) {
    return (
      <LocalCard
        product={result.localProduct}
        onScanAnother={onScanAnother}
      />
    );
  }

  const name = result.candidate?.name.value;
  return (
    <div className="space-y-3 border border-black/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-black/40">
        {result.resolutionStatus.replace(/_/g, " ")}
      </p>
      <h3 className="text-[18px] font-medium text-black">
        {name || "No product data yet"}
      </h3>
      <p className="text-[13px] text-black/50">
        {result.format.replace("_", "-")} · {result.barcode}
      </p>
      <p className="text-[13px] text-black/55">{result.message}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {onContinueReview ? (
          <button
            type="button"
            className={adminUi.btnPrimary}
            onClick={onContinueReview}
          >
            Review & create
          </button>
        ) : null}
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

function LocalCard({
  product,
  onScanAnother,
}: {
  product: LocalProductHit;
  onScanAnother?: () => void;
}) {
  return (
    <div className="space-y-3 border border-black/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-800">
        Already in KlikCollect
      </p>
      <h3 className="text-[18px] font-medium text-black">{product.name}</h3>
      <p className="text-[13px] text-black/50">
        {product.barcode || product.gtin} · {product.status}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/products/${product.id}`}
          className={cn(adminUi.btnPrimary, "inline-flex")}
        >
          Open product
        </Link>
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
