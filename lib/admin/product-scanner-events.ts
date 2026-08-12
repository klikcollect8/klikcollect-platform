export const PRODUCT_SCANNER_EVENT = "kc:open-product-scanner";

export type ProductScannerContext = "catalogue" | "discovery" | "page";

export type ProductScannerOpenDetail = {
  barcode?: string;
  discoveryId?: string;
  /** catalogue/discovery open popup; page is for the dedicated route only */
  context?: ProductScannerContext;
};

export function openProductScanner(detail?: ProductScannerOpenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ProductScannerOpenDetail>(PRODUCT_SCANNER_EVENT, {
      detail: detail || {},
    }),
  );
}
