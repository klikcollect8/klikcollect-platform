/** Normalize Kenya mobile to Paystack-friendly 2547XXXXXXXX */
export function normalizeKenyaPhone(input: string): string | null {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return null;

  let n = digits;
  if (n.startsWith("0") && n.length === 10) n = `254${n.slice(1)}`;
  else if (n.startsWith("7") && n.length === 9) n = `254${n}`;
  else if (n.startsWith("254") && n.length === 12) {
    // ok
  } else if (n.startsWith("2540") && n.length === 13) {
    n = `254${n.slice(4)}`;
  } else {
    return null;
  }

  if (!/^2547\d{8}$/.test(n)) return null;
  return n;
}

export function isValidKenyaMpesaPhone(input: string): boolean {
  return normalizeKenyaPhone(input) != null;
}
