"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { ScannerDetectMeta } from "@/components/admin/catalogue/scanner/BarcodeScannerPanel";

const BarcodeScannerPanel = dynamic(
  () => import("@/components/admin/catalogue/scanner/BarcodeScannerPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center text-[13px] text-black/45">
        Loading ZXing scanner…
      </div>
    ),
  },
);

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string, meta?: { format?: string }) => void;
};

/**
 * Modal wrapper around the advanced ZXing scanner panel.
 * Used by ProductCreateWizard and other overlays.
 */
export default function CatalogueBarcodeScanner({
  open,
  onClose,
  onDetected,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close scanner"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center justify-between border border-b-0 border-black/10 bg-[#f7f7f5] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/45">
            Product scanner
          </p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <BarcodeScannerPanel
          active={open}
          autoSubmit
          className="border-t-0"
          onDetected={(code, meta?: ScannerDetectMeta) => {
            onDetected(code, { format: meta?.format });
            onClose();
          }}
        />
      </div>
    </div>
  );
}
