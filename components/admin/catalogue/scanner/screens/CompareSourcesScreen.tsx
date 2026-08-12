"use client";

import SourceCompareMatrix from "@/components/admin/catalogue/scanner/SourceCompareMatrix";
import ScannerOverlayShell from "@/components/admin/catalogue/scanner/screens/ScannerOverlayShell";
import type { ResolveResult } from "@/lib/product-resolver/types";

type Props = {
  contextLabel: string;
  result: ResolveResult;
  onBack: () => void;
};

/** Provider-by-provider comparison on its own pop-up screen. */
export default function CompareSourcesScreen({
  contextLabel,
  result,
  onBack,
}: Props) {
  return (
    <ScannerOverlayShell
      eyebrow={`Scanner · ${contextLabel}`}
      ariaLabel="Compare sources"
      dismissKind="back"
      onDismiss={onBack}
      align="top"
    >
      <div className="mx-auto w-full max-w-[900px]">
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight text-black">
          Compare sources
        </h1>
        <p className="mt-2 font-mono text-[13px] text-black/45">
          {result.barcode}
        </p>
        <div className="mt-8">
          <SourceCompareMatrix providerResults={result.providerResults} />
        </div>
      </div>
    </ScannerOverlayShell>
  );
}
