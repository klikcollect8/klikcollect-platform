/** GTIN / EAN / UPC checksum helpers for catalogue barcodes. */

import {
  digitsOnly,
  normaliseBarcode,
  type BarcodeFormat,
} from "@/lib/catalogue/barcode-normalize";

export type GtinKind = "EAN-13" | "EAN-8" | "UPC-A" | "UPC-E" | "GTIN-14" | "ISBN" | "UNKNOWN";

export function normalizeDigits(raw: string): string {
  return digitsOnly(raw);
}

function formatToGtinKind(format: BarcodeFormat, digits: string): GtinKind {
  if (format === "EAN_13") {
    return digits.startsWith("978") || digits.startsWith("979") ? "ISBN" : "EAN-13";
  }
  if (format === "EAN_8") return "EAN-8";
  if (format === "UPC_A") return "UPC-A";
  if (format === "UPC_E") return "UPC-E";
  if (format === "GTIN_14" || format === "ITF") return "GTIN-14";
  return "UNKNOWN";
}

export function detectGtinKind(raw: string): GtinKind {
  const n = normaliseBarcode(raw, { requireGtin: true });
  return formatToGtinKind(n.format, n.value);
}

export function validateGtin(raw: string): {
  ok: boolean;
  kind: GtinKind;
  digits: string;
  error?: string;
} {
  const n = normaliseBarcode(raw, { requireGtin: true });
  const kind = formatToGtinKind(n.format, n.value);
  if (!n.valid) {
    return {
      ok: false,
      kind,
      digits: n.value,
      error: n.error || "Invalid barcode.",
    };
  }
  return { ok: true, kind, digits: n.value };
}
