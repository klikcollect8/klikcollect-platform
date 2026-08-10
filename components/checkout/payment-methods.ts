/** Checkout payment method catalog + rail mapping. */

export type PayMethod =
  | "stripe_checkout"
  | "stripe_card" // legacy alias → stripe_checkout
  | "paystack_card"
  | "mpesa"
  | "paystack_bank"
  | "paystack_ussd";

export type PayRail = "stripe" | "paystack";

export type PayApiMethod = "card" | "mpesa" | "bank" | "ussd";

export type PayMethodMeta = {
  id: PayMethod;
  label: string;
  shortLabel: string;
  description: string;
  rail: PayRail;
  apiMethod: PayApiMethod;
  hint: string;
  group: "stripe" | "paystack";
};

export const PAY_METHODS: PayMethodMeta[] = [
  {
    id: "stripe_checkout",
    label: "Card & wallets",
    shortLabel: "Stripe",
    description: "Visa, Mastercard, Apple Pay, Google Pay, Link",
    rail: "stripe",
    apiMethod: "card",
    hint: "Pay on Stripe Checkout",
    group: "stripe",
  },
  {
    id: "paystack_card",
    label: "Card",
    shortLabel: "Card",
    description: "Visa, Mastercard via Paystack",
    rail: "paystack",
    apiMethod: "card",
    hint: "Pay with card on Paystack",
    group: "paystack",
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    shortLabel: "M-Pesa",
    description: "Safaricom mobile money",
    rail: "paystack",
    apiMethod: "mpesa",
    hint: "STK push to your phone",
    group: "paystack",
  },
  {
    id: "paystack_bank",
    label: "Bank transfer",
    shortLabel: "Bank",
    description: "Pay from your bank account",
    rail: "paystack",
    apiMethod: "bank",
    hint: "Bank transfer via Paystack",
    group: "paystack",
  },
  {
    id: "paystack_ussd",
    label: "USSD",
    shortLabel: "USSD",
    description: "Pay with a USSD code",
    rail: "paystack",
    apiMethod: "ussd",
    hint: "Dial USSD to complete payment",
    group: "paystack",
  },
];

/** Normalize legacy ids. */
export function normalizePayMethod(id: PayMethod | string | null): PayMethod | null {
  if (!id) return null;
  if (id === "stripe_card") return "stripe_checkout";
  if (PAY_METHODS.some((m) => m.id === id)) return id as PayMethod;
  return null;
}

export function getPayMethodMeta(id: PayMethod | null): PayMethodMeta | null {
  const n = normalizePayMethod(id);
  if (!n) return null;
  return PAY_METHODS.find((m) => m.id === n) ?? null;
}

export function isStripePayMethod(id: PayMethod | null): boolean {
  const n = normalizePayMethod(id);
  return n === "stripe_checkout";
}

export function isMpesaPayMethod(id: PayMethod | null): boolean {
  return normalizePayMethod(id) === "mpesa";
}

export function isPaystackHostedMethod(id: PayMethod | null): boolean {
  const n = normalizePayMethod(id);
  return n === "paystack_card" || n === "paystack_bank" || n === "paystack_ussd";
}

export function defaultPayMethod(
  stripeReady: boolean,
  paystackReady: boolean,
): PayMethod | null {
  if (paystackReady) return "mpesa";
  if (stripeReady) return "stripe_checkout";
  return null;
}

export function availablePayMethods(
  stripeReady: boolean,
  paystackReady: boolean,
): PayMethodMeta[] {
  return PAY_METHODS.filter((m) =>
    m.rail === "stripe" ? stripeReady : paystackReady,
  );
}
