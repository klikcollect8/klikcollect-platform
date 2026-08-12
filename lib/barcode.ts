/**
 * GTIN / barcode helpers (Chapter 03 P-V1, OQ-P10).
 * Validates GTIN-8/12/13/14 check digits; normalises to digits-only.
 * Prefer `@/lib/catalogue/barcode-normalize` for new code.
 */

import {
  digitsOnly,
  normaliseBarcode as normaliseBarcodeFull,
} from "@/lib/catalogue/barcode-normalize";

/** @deprecated Use normaliseBarcode() from barcode-normalize for full result */
export function normaliseBarcode(raw: string): string {
  return digitsOnly(raw);
}

/** GS1 check-digit validation for GTIN-8, UPC-A (12), EAN-13, GTIN-14. */
export function isValidGtin(raw: string): boolean {
  return normaliseBarcodeFull(raw, { requireGtin: true }).valid;
}

/** Prefill source rule: scanned GTIN is authoritative identity; name/price come from catalogue. */
export type BarcodeLookupResult =
  | { ok: true; gtin: string; productId: string }
  | { ok: false; gtin: string; reason: "INVALID_GTIN" | "NOT_FOUND" };
