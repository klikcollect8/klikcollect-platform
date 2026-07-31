/**
 * GTIN / barcode helpers (Chapter 03 P-V1, OQ-P10).
 * Validates GTIN-8/12/13/14 check digits; normalises to digits-only.
 */

export function normaliseBarcode(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

/** GS1 check-digit validation for GTIN-8, UPC-A (12), EAN-13, GTIN-14. */
export function isValidGtin(raw: string): boolean {
  const digits = normaliseBarcode(raw);
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  if (!/^\d+$/.test(digits)) return false;

  const body = digits.slice(0, -1);
  const check = Number(digits.slice(-1));
  let sum = 0;
  // From rightmost body digit, alternate ×3 / ×1
  const reversed = body.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    const n = Number(reversed[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const expected = (10 - (sum % 10)) % 10;
  return expected === check;
}

/** Prefill source rule: scanned GTIN is authoritative identity; name/price come from catalogue. */
export type BarcodeLookupResult =
  | { ok: true; gtin: string; productId: string }
  | { ok: false; gtin: string; reason: "INVALID_GTIN" | "NOT_FOUND" };
