"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import ScannerWorkspace from "@/components/admin/catalogue/scanner/ScannerWorkspace";
import type { ProductScannerContext } from "@/lib/admin/product-scanner-events";
import { cn } from "@/lib/utils";

export type ProductScannerModalProps = {
  open: boolean;
  onClose: () => void;
  initialBarcode?: string;
  discoveryId?: string;
  context?: Exclude<ProductScannerContext, "page">;
};

/**
 * Large scanner popup (catalogue / discovery). Page uses ScannerWorkspace directly.
 */
export default function ProductScannerModal({
  open,
  onClose,
  initialBarcode,
  discoveryId,
  context = "catalogue",
}: ProductScannerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/30 p-3 pt-[3vh] backdrop-blur-[2px] sm:p-6 sm:pt-[4vh]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close scanner"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl",
          "h-[min(94vh,960px)]",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Product scanner"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {context === "discovery" ? "Discovery" : "Catalogue"}
            </p>
            <h2 className="text-[17px] font-medium tracking-tight text-slate-900">
              Product scanner
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
              Esc
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900"
            >
              <X className="h-4 w-4" /> Close
            </button>
          </div>
        </div>
        <ScannerWorkspace
          key={`${context}-${initialBarcode || ""}-${discoveryId || ""}`}
          context={context}
          variant="popup"
          initialBarcode={initialBarcode}
          discoveryId={discoveryId}
          onRequestClose={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
