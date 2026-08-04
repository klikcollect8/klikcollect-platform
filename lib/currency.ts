/**
 * Currency formatting for KES (Kenyan Shillings)
 */

export const CURRENCY = "KES" as const;
export const CURRENCY_SYMBOL = "Ksh.";

/** Format a price for display in Kenyan Shillings */
export function formatPrice(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return " - ";
  return `${CURRENCY_SYMBOL} ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/** @deprecated Gift wrap removed from checkout — kept for legacy imports. */
export const GIFT_WRAP_PRICE = 0;
