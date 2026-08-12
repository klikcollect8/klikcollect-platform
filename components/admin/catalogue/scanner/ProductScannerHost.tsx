"use client";

import { useCallback, useEffect, useState } from "react";
import ProductScannerModal from "@/components/admin/catalogue/scanner/ProductScannerModal";
import {
  PRODUCT_SCANNER_EVENT,
  type ProductScannerContext,
  type ProductScannerOpenDetail,
} from "@/lib/admin/product-scanner-events";

/** Listens for openProductScanner() — popup for catalogue/discovery only. */
export default function ProductScannerHost() {
  const [open, setOpen] = useState(false);
  const [barcode, setBarcode] = useState<string | undefined>();
  const [discoveryId, setDiscoveryId] = useState<string | undefined>();
  const [context, setContext] = useState<"catalogue" | "discovery">(
    "catalogue",
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<ProductScannerOpenDetail>).detail || {};
      const ctx: ProductScannerContext = detail.context || "catalogue";
      // Page context is handled by /admin/products/scanner route
      if (ctx === "page") return;
      setBarcode(detail.barcode);
      setDiscoveryId(detail.discoveryId);
      setContext(ctx);
      setOpen(true);
    };
    window.addEventListener(PRODUCT_SCANNER_EVENT, onOpen);
    return () => window.removeEventListener(PRODUCT_SCANNER_EVENT, onOpen);
  }, []);

  const onClose = useCallback(() => {
    setOpen(false);
    setBarcode(undefined);
    setDiscoveryId(undefined);
    setContext("catalogue");
  }, []);

  return (
    <ProductScannerModal
      open={open}
      onClose={onClose}
      initialBarcode={barcode}
      discoveryId={discoveryId}
      context={context}
    />
  );
}
