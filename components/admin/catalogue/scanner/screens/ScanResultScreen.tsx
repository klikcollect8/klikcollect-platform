"use client";

import Link from "next/link";
import SourceProgressList from "@/components/admin/catalogue/scanner/SourceProgressList";
import ScannerOverlayShell from "@/components/admin/catalogue/scanner/screens/ScannerOverlayShell";
import {
  scoreMatchConfidence,
  type MatchConfidence,
} from "@/lib/product-resolver/match-confidence";
import type { ResolveResult } from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

type Props = {
  contextLabel: string;
  loading: boolean;
  result: ResolveResult | null;
  error: string | null;
  barcode?: string | null;
  continuous: boolean;
  onBack: () => void;
  onReview: () => void;
  onCompare: () => void;
  onCreate: () => void;
  onScanAnother: () => void;
};

const rowClass =
  "border-b border-black/[0.08] py-3.5 text-[13px] font-medium uppercase tracking-[0.14em] text-black/70 transition-colors hover:text-black";

function ConfidenceBadge({ conf }: { conf: MatchConfidence }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em]",
        conf.band === "high" && "text-emerald-800",
        conf.band === "medium" && "text-amber-900",
        conf.band === "low" && "text-red-800",
      )}
    >
      <span className="tabular-nums">{conf.score}%</span>
      <span className="text-black/40">·</span>
      {conf.label}
    </span>
  );
}

/** Scan result as its own minimal pop-up screen. */
export default function ScanResultScreen({
  contextLabel,
  loading,
  result,
  error,
  barcode,
  continuous,
  onBack,
  onReview,
  onCompare,
  onCreate,
  onScanAnother,
}: Props) {
  const conf = result ? scoreMatchConfidence(result) : null;
  const inCatalogue = Boolean(result?.localProduct);
  const name =
    result?.localProduct?.name ||
    result?.candidate?.name?.value ||
    (loading ? "Looking up…" : result?.barcode || barcode || "No result");
  const brand =
    result?.localProduct?.brand || result?.candidate?.brand?.value || null;
  const qty = result?.candidate?.quantity?.value || null;
  const image =
    result?.localProduct?.image || result?.candidate?.images?.[0]?.url || null;
  const status = loading
    ? "Searching"
    : !result
      ? error
        ? "Scan queued"
        : "No result"
      : inCatalogue
        ? "In catalogue"
        : result.resolutionStatus === "not_found"
          ? "No match found"
          : "Product match";

  return (
    <ScannerOverlayShell
      eyebrow={`Scanner · ${contextLabel}`}
      ariaLabel="Scan result"
      dismissKind="back"
      onDismiss={onBack}
    >
      <div className="w-full max-w-[380px] text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
          {status}
        </p>

        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="mx-auto mt-6 h-28 w-28 object-contain"
          />
        ) : null}

        <h1 className="mt-5 text-[clamp(1.5rem,3vw,2rem)] font-medium leading-tight tracking-tight text-black">
          {name}
        </h1>
        {brand || qty ? (
          <p className="mt-2 text-[14px] leading-relaxed text-black/45">
            {[brand, qty].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <p className="mt-2 break-all font-mono text-[12px] text-black/40">
          {result?.barcode || barcode || ""}
        </p>
        {conf ? (
          <div className="mt-3">
            <ConfidenceBadge conf={conf} />
          </div>
        ) : null}

        {error ? (
          <p
            className="mt-5 text-[13px] leading-relaxed text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mx-auto mt-8 max-w-[300px] border-t border-black/10 pt-4 text-left">
          <SourceProgressList
            loading={loading}
            providerResults={result?.providerResults || []}
          />
        </div>

        {!loading ? (
          <>
            <nav className="mt-9 flex flex-col">
              {result && inCatalogue ? (
                <Link
                  href={`/admin/products/${result.localProduct!.id}`}
                  className={rowClass}
                >
                  View product
                </Link>
              ) : result && result.resolutionStatus === "not_found" ? (
                <button type="button" onClick={onCreate} className={rowClass}>
                  Create product
                </button>
              ) : result ? (
                <>
                  <button
                    type="button"
                    onClick={onReview}
                    className={rowClass}
                  >
                    Review product
                  </button>
                  <button
                    type="button"
                    onClick={onCompare}
                    className={rowClass}
                  >
                    Compare sources
                  </button>
                  <button
                    type="button"
                    onClick={onCreate}
                    className={rowClass}
                  >
                    {conf?.requiresConfirmation
                      ? "Edit before creating"
                      : "Use product"}
                  </button>
                </>
              ) : null}
            </nav>

            <button
              type="button"
              onClick={onScanAnother}
              className="mt-9 text-[13px] text-black/45 underline decoration-black/20 underline-offset-[5px] transition-colors hover:text-black hover:decoration-black"
            >
              {continuous ? "Keep scanning" : "Scan another"}
            </button>
          </>
        ) : null}
      </div>
    </ScannerOverlayShell>
  );
}
