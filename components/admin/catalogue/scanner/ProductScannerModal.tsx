"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * Full-screen scanner pop-up (catalogue / discovery), matching the sign-in /
 * profile / search overlay pattern. The page route mounts ScannerWorkspace
 * directly.
 */
export default function ProductScannerModal({
  open,
  onClose,
  initialBarcode,
  discoveryId,
  context = "catalogue",
}: ProductScannerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      // Escape is owned by ScannerWorkspace (steps back through screens,
      // then calls onRequestClose). This handler only traps Tab.
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const focusFrame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-scanner-title"
      tabIndex={-1}
      className={cn(
        "fixed inset-0 z-[9999] bg-black outline-none transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="sr-only">
        <h2 id="product-scanner-title">Product scanner</h2>
        <p>
          {context === "discovery"
            ? "Scan products for discovery"
            : "Scan products for the catalogue"}
        </p>
      </div>
      <ScannerWorkspace
        key={`${context}-${initialBarcode || ""}-${discoveryId || ""}`}
        context={context}
        variant="popup"
        initialBarcode={initialBarcode}
        discoveryId={discoveryId}
        onRequestClose={handleClose}
        className="h-full"
      />
    </div>,
    document.body,
  );
}
