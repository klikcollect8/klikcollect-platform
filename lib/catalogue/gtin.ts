/** GTIN / EAN / UPC checksum helpers for catalogue barcodes. */

export type GtinKind = "EAN-13" | "EAN-8" | "UPC-A" | "UPC-E" | "GTIN-14" | "ISBN" | "UNKNOWN";

export function normalizeDigits(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

function mod10Check(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 8) return false;
  const body = digits.slice(0, -1);
  const check = Number(digits.slice(-1));
  let sum = 0;
  const rev = body.split("").reverse();
  for (let i = 0; i < rev.length; i++) {
    const n = Number(rev[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

export function detectGtinKind(raw: string): GtinKind {
  const d = normalizeDigits(raw);
  if (d.length === 8) return "EAN-8";
  if (d.length === 12) return "UPC-A";
  if (d.length === 13) return d.startsWith("978") || d.startsWith("979") ? "ISBN" : "EAN-13";
  if (d.length === 14) return "GTIN-14";
  if (d.length === 6 || d.length === 7) return "UPC-E";
  return "UNKNOWN";
}

export function validateGtin(raw: string): { ok: boolean; kind: GtinKind; digits: string; error?: string } {
  const digits = normalizeDigits(raw);
  const kind = detectGtinKind(digits);
  if (!digits) {
    return { ok: false, kind, digits, error: "Barcode is required." };
  }
  if (kind === "UNKNOWN") {
    return {
      ok: false,
      kind,
      digits,
      error: "Unsupported barcode length. Use EAN-8/13, UPC-A, or GTIN-14.",
    };
  }
  if (kind === "UPC-E") {
    // Accept UPC-E without forcing expansion checksum in v1
    return { ok: true, kind, digits };
  }
  if (!mod10Check(digits)) {
    return { ok: false, kind, digits, error: `Invalid ${kind} checksum.` };
  }
  return { ok: true, kind, digits };
}
