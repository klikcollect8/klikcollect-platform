/**
 * Single ingress for every barcode entering KlikCollect.
 * Always returns a STRING — never coerce to number (leading zeroes).
 */

export type BarcodeFormat =
  | "EAN_13"
  | "EAN_8"
  | "UPC_A"
  | "UPC_E"
  | "GTIN_14"
  | "CODE_128"
  | "CODE_39"
  | "ITF"
  | "QR_CODE"
  | "UNKNOWN";

export type NormalisedBarcode = {
  /** Digits-only for GTIN family; original alphanumeric for Code128/39 when applicable */
  value: string;
  /** Raw after trim/separator strip, before format heuristics */
  raw: string;
  format: BarcodeFormat;
  valid: boolean;
  checksumOk: boolean | null;
  error?: string;
};

const SEPARATORS = /[\s\-_.]/g;

/** Strip whitespace/separators; keep alphanumeric for non-GTIN codes. */
export function stripBarcodeNoise(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(SEPARATORS, "")
    .toUpperCase();
}

/** Digits only — preserves leading zeroes as string. */
export function digitsOnly(raw: string): string {
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
  return (10 - (sum % 10)) % 10 === check;
}

export function detectBarcodeFormat(
  value: string,
  hint?: string | null,
): BarcodeFormat {
  const hintNorm = (hint || "").toLowerCase().replace(/[- ]/g, "_");
  if (hintNorm.includes("ean_13") || hintNorm === "ean13") return "EAN_13";
  if (hintNorm.includes("ean_8") || hintNorm === "ean8") return "EAN_8";
  if (hintNorm.includes("upc_a") || hintNorm === "upca") return "UPC_A";
  if (hintNorm.includes("upc_e") || hintNorm === "upce") return "UPC_E";
  if (hintNorm.includes("gtin") || hintNorm.includes("itf")) {
    if (value.length === 14) return "GTIN_14";
    if (hintNorm.includes("itf")) return "ITF";
  }
  if (hintNorm.includes("code_128") || hintNorm.includes("code128"))
    return "CODE_128";
  if (hintNorm.includes("code_39") || hintNorm.includes("code39"))
    return "CODE_39";
  if (hintNorm.includes("qr")) return "QR_CODE";

  const d = digitsOnly(value);
  if (/^\d+$/.test(value) || d === value) {
    if (d.length === 8) return "EAN_8";
    if (d.length === 12) return "UPC_A";
    if (d.length === 13) return "EAN_13";
    if (d.length === 14) return "GTIN_14";
    if (d.length === 6 || d.length === 7) return "UPC_E";
  }
  if (/^[0-9A-Z.\-+/$% ]+$/i.test(value) && /[A-Z]/i.test(value)) {
    return "CODE_39";
  }
  if (value.length >= 4) return "CODE_128";
  return "UNKNOWN";
}

/**
 * Normalise and validate a barcode for catalogue / resolver use.
 * Prefer GTIN family for retail; allow alphanumeric Code128/39 without checksum.
 */
export function normaliseBarcode(
  rawInput: string,
  opts?: { formatHint?: string | null; requireGtin?: boolean },
): NormalisedBarcode {
  const raw = stripBarcodeNoise(rawInput);
  if (!raw) {
    return {
      value: "",
      raw: "",
      format: "UNKNOWN",
      valid: false,
      checksumOk: null,
      error: "Barcode is required.",
    };
  }

  if (!/^[0-9A-Z.\-+/$%]+$/i.test(raw)) {
    return {
      value: "",
      raw,
      format: "UNKNOWN",
      valid: false,
      checksumOk: null,
      error: "Barcode contains invalid characters.",
    };
  }

  const format = detectBarcodeFormat(raw, opts?.formatHint);
  const isGtinFamily = (
    ["EAN_13", "EAN_8", "UPC_A", "UPC_E", "GTIN_14", "ITF"] as BarcodeFormat[]
  ).includes(format);

  if (isGtinFamily || /^\d+$/.test(raw)) {
    const value = digitsOnly(raw);
    if (!value) {
      return {
        value: "",
        raw,
        format,
        valid: false,
        checksumOk: null,
        error: "Barcode must contain digits.",
      };
    }

    if (format === "UPC_E" || value.length === 6 || value.length === 7) {
      return {
        value,
        raw,
        format: "UPC_E",
        valid: true,
        checksumOk: null,
      };
    }

    if (![8, 12, 13, 14].includes(value.length)) {
      if (opts?.requireGtin !== false && isGtinFamily) {
        return {
          value,
          raw,
          format,
          valid: false,
          checksumOk: false,
          error:
            "Unsupported barcode length. Use EAN-8/13, UPC-A, or GTIN-14.",
        };
      }
    }

    const checksumOk = [8, 12, 13, 14].includes(value.length)
      ? mod10Check(value)
      : null;

    if (checksumOk === false) {
      return {
        value,
        raw,
        format: detectBarcodeFormat(value, opts?.formatHint),
        valid: false,
        checksumOk: false,
        error: `Invalid ${detectBarcodeFormat(value)} checksum.`,
      };
    }

    return {
      value,
      raw,
      format: detectBarcodeFormat(value, opts?.formatHint),
      valid: true,
      checksumOk: checksumOk === true ? true : null,
    };
  }

  // Alphanumeric retail codes
  if (opts?.requireGtin) {
    return {
      value: raw,
      raw,
      format,
      valid: false,
      checksumOk: null,
      error: "A GTIN/EAN/UPC barcode is required.",
    };
  }

  return {
    value: raw,
    raw,
    format,
    valid: raw.length >= 4,
    checksumOk: null,
    error: raw.length < 4 ? "Barcode is too short." : undefined,
  };
}

/** Map ZXing / BarcodeDetector format strings into our enum. */
export function formatFromScannerLibrary(libFormat: string): BarcodeFormat {
  return detectBarcodeFormat("", libFormat);
}

// Compatibility re-exports used by older catalogue code paths
export { digitsOnly as normalizeDigits };
