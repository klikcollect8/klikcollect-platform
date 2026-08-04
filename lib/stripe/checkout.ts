import { getStripe, stripeCurrency } from "@/lib/stripe/client";
import { publicId } from "@/lib/ids";

export async function createStripeCheckoutSession(input: {
  email: string;
  amountMinor: number;
  reference: string;
  orderPublicId: string | null;
  orderIds: string[];
  origin: string;
  lineItems?: Array<{ name?: string; quantity?: number; price?: number }>;
}) {
  const stripe = getStripe();
  const currency = stripeCurrency();
  const successUrl = `${input.origin}/payment/callback?reference=${encodeURIComponent(input.reference)}&provider=stripe&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${input.origin}/checkout?cancelled=1`;

  const description =
    input.orderIds.length > 1
      ? `KlikCollect orders (${input.orderIds.length})`
      : `KlikCollect order ${input.orderPublicId || input.reference}`;

  const integrationSuffix = publicId("chk").slice(-8);

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
    },
    payment_intent_data: {
      metadata: {
        reference: input.reference,
        orderPublicId: input.orderPublicId || "",
        orderIds: input.orderIds.join(","),
        provider: "stripe",
      },
    },
    // Tag sessions for Dashboard comparison (API 2026-03-25+)
    integration_identifier: `klikcollect_checkout_${integrationSuffix}`,
  } as never);

  return session;
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
}
