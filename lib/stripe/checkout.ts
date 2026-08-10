import { getStripe, stripeCurrency } from "@/lib/stripe/client";

/**
 * Stripe Checkout Session with dynamic payment methods
 * (card, Apple Pay, Google Pay, Link — whatever is enabled for the account).
 */
export async function createStripeCheckoutSession(input: {
  email: string;
  amountMinor: number;
  reference: string;
  orderPublicId: string | null;
  orderIds: string[];
  origin: string;
  lineItems?: Array<{ name?: string; quantity?: number; price?: number }>;
  callbackQuery?: Record<string, string | undefined | null>;
  cancelUrl?: string;
}) {
  const stripe = getStripe();
  const currency = stripeCurrency();
  const params = new URLSearchParams({
    reference: input.reference,
    provider: "stripe",
    session_id: "{CHECKOUT_SESSION_ID}",
  });
  for (const [key, value] of Object.entries(input.callbackQuery || {})) {
    if (value) params.set(key, String(value));
  }
  // Stripe requires the literal `{CHECKOUT_SESSION_ID}` placeholder unencoded
  const successUrl = `${input.origin}/payment/callback?${params
    .toString()
    .replace(
      encodeURIComponent("{CHECKOUT_SESSION_ID}"),
      "{CHECKOUT_SESSION_ID}",
    )}`;
  const cancelUrl = input.cancelUrl || `${input.origin}/checkout?cancelled=1`;

  const description =
    input.orderIds.length > 1
      ? `KlikCollect orders (${input.orderIds.length})`
      : `KlikCollect order ${input.orderPublicId || input.reference}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: input.reference,
    // Dynamic payment methods — do not set payment_method_types
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: Math.round(input.amountMinor),
          product_data: {
            name: description,
            description:
              Array.isArray(input.lineItems) && input.lineItems.length
                ? input.lineItems
                    .slice(0, 6)
                    .map((l) => `${l.quantity || 1}× ${l.name || "Item"}`)
                    .join(", ")
                : undefined,
          },
        },
      },
    ],
    metadata: {
      reference: input.reference,
      orderPublicId: input.orderPublicId || "",
      orderIds: input.orderIds.join(","),
      provider: "stripe",
      source: input.callbackQuery?.source || "",
      fulfilment: input.callbackQuery?.fulfilment || "",
    },
    payment_intent_data: {
      metadata: {
        reference: input.reference,
        orderPublicId: input.orderPublicId || "",
        orderIds: input.orderIds.join(","),
        provider: "stripe",
        source: input.callbackQuery?.source || "",
        fulfilment: input.callbackQuery?.fulfilment || "",
      },
    },
  });

  return session;
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}
