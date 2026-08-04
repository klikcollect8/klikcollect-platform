import { getServiceSupabase } from "@/lib/supabase/admin";
import { postLedgerTransaction } from "@/lib/ledger/post";
import { publicId } from "@/lib/ids";

export type CaptureInput = {
  reference: string;
  amountMinor: number;
  channel?: string | null;
  customerEmail?: string | null;
  orderPublicId?: string | null;
  clerkUserId?: string | null;
  lineItems?: unknown[];
  provider?: "paystack" | "stripe";
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
};

/**
 * Idempotent payment success handler shared by verify + webhooks.
 * Ledger key: ${provider}:${reference}
 */
export async function captureSuccessfulPayment(
  input: CaptureInput,
): Promise<{ receiptPublicId: string | null; already: boolean }> {
  const supabase = getServiceSupabase();
  const reference = input.reference;
  const amount = Math.round(input.amountMinor);
  const channel = input.channel || "card";
  const provider = input.provider || "paystack";

  let intent: Record<string, unknown> | null = null;

  const { data: byRef } = await supabase
    .from("payment_intents")
    .select("*")
    .eq("paystack_reference", reference)
    .maybeSingle();
  intent = byRef;

  if (!intent && input.stripeCheckoutSessionId) {
    const { data } = await supabase
      .from("payment_intents")
      .select("*")
      .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
      .maybeSingle();
    intent = data;
  }
  if (!intent && input.stripePaymentIntentId) {
    const { data } = await supabase
      .from("payment_intents")
      .select("*")
      .eq("stripe_payment_intent_id", input.stripePaymentIntentId)
      .maybeSingle();
    intent = data;
  }

  const orderPublicId =
    input.orderPublicId ||
    (intent?.order_public_id ? String(intent.order_public_id) : null);
  const clerkUserId =
    input.clerkUserId ||
    (intent?.clerk_user_id ? String(intent.clerk_user_id) : null);
  const email =
    input.customerEmail || (intent?.email ? String(intent.email) : null);
  const intentMeta =
    intent?.metadata && typeof intent.metadata === "object"
      ? (intent.metadata as Record<string, unknown>)
      : {};
  const intentLineItems = Array.isArray(intentMeta.lineItems)
    ? intentMeta.lineItems
    : [];
  const lineItems = input.lineItems?.length ? input.lineItems : intentLineItems;

  if (intent?.public_id) {
    await supabase
      .from("payment_intents")
      .update({
        status: "success",
        provider,
        stripe_checkout_session_id:
          input.stripeCheckoutSessionId ||
          intent.stripe_checkout_session_id ||
          null,
        stripe_payment_intent_id:
          input.stripePaymentIntentId ||
          intent.stripe_payment_intent_id ||
          null,
        updated_at: new Date().toISOString(),
        metadata: {
          ...intentMeta,
          channel,
          provider,
        },
      })
      .eq("public_id", String(intent.public_id));
  }

  const metaOrderIds = Array.isArray(intentMeta.orderIds)
    ? intentMeta.orderIds.map(String)
    : [];
  const orderIds = [
    ...new Set(
      [orderPublicId, ...metaOrderIds].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      ),
    ),
  ];

  if (orderIds.length > 0) {
    const paidAt = new Date().toISOString();
    const patch = {
      payment_status: "paid",
      payment_reference: reference,
      payment_method:
        channel.includes("mobile") || channel === "mpesa" ? "mpesa" : "card",
      payment_channel: channel,
      paid_at: paidAt,
    };
    for (const oid of orderIds) {
      const { data: byPublic } = await supabase
        .from("orders")
        .update(patch)
        .eq("public_id", oid)
        .select("id")
        .maybeSingle();
      if (!byPublic) {
        await supabase.from("orders").update(patch).eq("id", oid);
      }
    }
  }

  const cashCode =
    provider === "stripe"
      ? "cash_stripe"
      : channel.includes("mobile") || channel === "mpesa"
        ? "mpesa_clearing"
        : "cash_paystack";

  if (provider === "stripe") {
    await supabase.from("ledger_accounts").upsert(
      {
        code: "cash_stripe",
        name: "Stripe cash",
        account_type: "asset",
        owner_type: "platform",
      },
      { onConflict: "code", ignoreDuplicates: true },
    );
  }

  const ledger = await postLedgerTransaction({
    type: "payment_capture",
    referenceType: provider,
    referenceId: null,
    idempotencyKey: `${provider}:${reference}`,
    legs: [
      { accountCode: cashCode, amountMinor: amount, ownerType: "platform" },
      {
        accountCode: "revenue_clearing",
        amountMinor: -amount,
        ownerType: "platform",
      },
    ],
  });

  const already = ledger.ok && !!ledger.transactionId;

  const { data: existingReceipt } = await supabase
    .from("payment_receipts")
    .select("public_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (existingReceipt?.public_id) {
    return { receiptPublicId: existingReceipt.public_id, already: true };
  }

  const receiptPublic = publicId("rcpt");
  const { data: receipt, error } = await supabase
    .from("payment_receipts")
    .insert({
      public_id: receiptPublic,
      order_public_id: orderPublicId,
      payment_intent_public_id: intent?.public_id
        ? String(intent.public_id)
        : null,
      paystack_reference: reference,
      clerk_user_id: clerkUserId,
      customer_email: email,
      amount_minor: amount,
      channel: provider === "stripe" ? `stripe:${channel}` : channel,
      line_items: lineItems || [],
      paid_at: new Date().toISOString(),
    })
    .select("public_id")
    .single();

  if (error) {
    const { data: again } = await supabase
      .from("payment_receipts")
      .select("public_id")
      .eq("paystack_reference", reference)
      .maybeSingle();
    return { receiptPublicId: again?.public_id || null, already: true };
  }

  // Stripe: create pending vendor transfers (released on order collected)
  if (provider === "stripe" && !already && orderIds.length) {
    try {
      const feeQuote = intentMeta.feeQuote as
        | {
            byVendor?: Array<{
              vendorPublicId: string;
              goodsMinor: number;
              commissionMinor: number;
              deliveryMinor: number;
              netMinor: number;
            }>;
          }
        | undefined;
      if (feeQuote?.byVendor?.length) {
        const { createPendingVendorTransfers } = await import(
          "@/lib/stripe/transfers"
        );
        await createPendingVendorTransfers({
          orderIds,
          paymentIntentPublicId: intent?.public_id
            ? String(intent.public_id)
            : reference,
          feeQuote: {
            goodsMinor: 0,
            commissionMinor: 0,
            deliveryMinor: 0,
            customerTotalMinor: amount,
            byVendor: feeQuote.byVendor,
            rulesApplied: [],
          },
        });
      }
    } catch (e) {
      console.error("[capture] pending transfers", e);
    }
  }

  return {
    receiptPublicId: receipt?.public_id || receiptPublic,
    already: !ledger.ok ? false : already,
  };
}
