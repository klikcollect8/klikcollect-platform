"use client";

import Link from "next/link";
import ProductIntelligenceSheet from "@/components/admin/catalogue/resolver/ProductIntelligenceSheet";
import ProductVisualBoard from "@/components/admin/catalogue/scanner/ProductVisualBoard";
import SourceCompareMatrix from "@/components/admin/catalogue/scanner/SourceCompareMatrix";
import ScannerOverlayShell from "@/components/admin/catalogue/scanner/screens/ScannerOverlayShell";
import type { MatchConfidence } from "@/lib/product-resolver/match-confidence";
import type {
  ResolveResult,
  SimilarProductHit,
} from "@/lib/product-resolver/types";

type Option = { id: string; name: string };

type Props = {
  contextLabel: string;
  result: ResolveResult;
  conf: MatchConfidence | null;
  continuous: boolean;
  showCreate: boolean;
  categories: Option[];
  brands: Option[];
  boardContext: "discovery" | "catalogue";
  onBack: () => void;
  onKeepScanning: () => void;
  onStartCreate: () => void;
  onResolveBarcode: (code: string) => void;
  onEnqueueVariant?: (hit: SimilarProductHit) => void;
  onCreated: (id: string) => void;
};

/** Review-and-create workspace on its own pop-up screen. */
export default function ReviewCreateScreen({
  contextLabel,
  result,
  conf,
  continuous,
  showCreate,
  categories,
  brands,
  boardContext,
  onBack,
  onKeepScanning,
  onStartCreate,
  onResolveBarcode,
  onEnqueueVariant,
  onCreated,
}: Props) {
  const name =
    result.localProduct?.name || result.candidate?.name?.value || result.barcode;

  return (
    <ScannerOverlayShell
      eyebrow={`Scanner · ${contextLabel} · Review`}
      ariaLabel="Review scanned product"
      dismissKind="back"
      onDismiss={onBack}
      align="top"
    >
      <div className="mx-auto w-full max-w-[1100px]">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium leading-tight tracking-tight text-black">
          {name}
        </h1>
        <p className="mt-2 font-mono text-[13px] text-black/45">
          {result.barcode}
          {conf ? (
            <span className="ml-3 font-sans text-[11px] uppercase tracking-[0.12em] text-black/40">
              {conf.score}% · {conf.label}
            </span>
          ) : null}
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-8">
            <ProductVisualBoard
              result={result}
              context={boardContext}
              onResolveBarcode={onResolveBarcode}
              onEnqueueVariant={onEnqueueVariant}
            />
            <SourceCompareMatrix providerResults={result.providerResults} />
          </div>

          <div className="min-w-0">
            {result.localProduct ? (
              <Link
                href={`/admin/products/${result.localProduct.id}`}
                className="flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
              >
                Open product
              </Link>
            ) : showCreate || conf?.requiresConfirmation ? (
              <div className="space-y-3">
                {conf?.requiresConfirmation ? (
                  <p className="text-[12px] leading-relaxed text-amber-900">
                    Confidence is {conf.band} — confirm fields before creating a
                    canonical product.
                  </p>
                ) : null}
                <ProductIntelligenceSheet
                  key={result.barcode}
                  result={result}
                  categories={categories}
                  brands={brands}
                  onScanAnother={onKeepScanning}
                  onResolveBarcode={onResolveBarcode}
                  onCreated={onCreated}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={onStartCreate}
                className="flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
              >
                Add as product
              </button>
            )}

            <button
              type="button"
              onClick={onKeepScanning}
              className="mt-8 text-[13px] text-black/45 underline decoration-black/20 underline-offset-[5px] transition-colors hover:text-black hover:decoration-black"
            >
              {continuous ? "Keep scanning" : "Back to scanner"}
            </button>
          </div>
        </div>
      </div>
    </ScannerOverlayShell>
  );
}
