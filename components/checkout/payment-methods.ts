/** Checkout payment method catalog + rail mapping. */

export type PayMethod = "stripe_card" | "mpesa";

export type PayRail = "stripe" | "paystack";

export type PayMethodMeta = {
  id: PayMethod;
  label: string;
  shortLabel: string;
  description: string;
  rail: PayRail;
  apiMethod: "card" | "mpesa";
  hint: string;
};

export const PAY_METHODS: PayMethodMeta[] = [
  {
    id: "stripe_card",
    label: "Card",
    shortLabel: "Card",
    description: "Visa, Mastercard via Stripe",
    rail: "stripe",
    apiMethod: "card",
    hint: "Pay securely with card",
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    shortLabel: "M-Pesa",
    description: "Safaricom mobile money",
    rail: "paystack",
    apiMethod: "mpesa",
    hint: "STK push to your phone",
  },
];

export function getPayMethodMeta(id: PayMethod | null): PayMethodMeta | null {
  if (!id) return null;
  return PAY_METHODS.find((m) => m.id === id) ?? null;
}

export function isStripePayMethod(id: PayMethod | null): boolean {
  return id === "stripe_card";
}

export function isMpesaPayMethod(id: PayMethod | null): boolean {
  return id === "mpesa";
}

export function defaultPayMethod(
  stripeReady: boolean,
  paystackReady: boolean,
): PayMethod | null {
  if (stripeReady) return "stripe_card";
  if (paystackReady) return "mpesa";
  return null;
}
