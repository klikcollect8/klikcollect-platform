/**
 * Money helpers - INV-1 / ADR-0007 / ADR-0019.
 * Store and compute as integer minor units (KES cents). Display via formatters.
 *
 * Legacy catalogue prices in this spike are still major-unit KES integers
 * (e.g. 26000 = Ksh 26,000). Prefer moneyMinor for new writes.
 */

export const CURRENCY_CODE = "KES" as const;
export type MoneyMinor = number;

export function majorToMinor(major: number): MoneyMinor {
  return Math.round(Number(major) * 100);
}

export function minorToMajor(minor: MoneyMinor): number {
  return Number(minor) / 100;
}

/** Format integer KES cents for en-KE display */
export function formatMoneyMinor(
  minor: MoneyMinor,
  currency: "KES" = "KES",
): string {
  if (!Number.isFinite(minor) || !Number.isInteger(minor)) {
    return " - ";
  }
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minorToMajor(minor));
}

/** Alias used by OS surfaces */
export const formatKesMinor = formatMoneyMinor;

/** Format legacy major-unit KES amounts used by existing catalogue */
export function formatKesMajor(major: number): string {
  if (!Number.isFinite(major)) return " - ";
  return `Ksh. ${Number(major).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
