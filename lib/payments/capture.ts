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

  const { data: existingReceipt } = await supabase
    .from("payment_receipts")
    .select("public_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (existingReceipt?.public_id) {
    return { receiptPublicId: existingReceipt.public_id, already: true };
  }

  const intentAmount =
    intent?.amount_minor != null ? Math.round(Number(intent.amount_minor)) : 0;
  if (intentAmount > 0 && amount > 0 && amount + 1 < intentAmount) {
    throw new Error(
      `Underpayment: gateway ${amount} < intent ${intentAmount} for ${reference}`,
    );
  }

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

  if (!ledger.ok) {
    throw new Error(ledger.error || "Ledger post failed");
  }

  // Paystack primary: allocate clearing → vendor_payable_* + platform_fees
  if (provider === "paystack" && orderIds.length) {
    try {
      await allocateVendorPayables({
        supabase,
        orderIds,
        amountMinor: amount,
        reference,
        feeQuote: intentMeta.feeQuote as
          | {
              byVendor?: Array<{
                vendorPublicId: string;
                goodsMinor: number;
                commissionMinor: number;
                deliveryMinor: number;
                netMinor: number;
              }>;
              commissionMinor?: number;
            }
          | undefined,
      });
    } catch (e) {
      console.error("[capture] vendor payable allocation", e);
    }
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
  if (provider === "stripe" && orderIds.length) {
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
    already: false,
  };
}

const DEFAULT_COMMISSION_BPS = 1000; // 10%

async function allocateVendorPayables(input: {
  supabase: ReturnType<typeof getServiceSupabase>;
  orderIds: string[];
  amountMinor: number;
  reference: string;
  feeQuote?: {
    byVendor?: Array<{
      vendorPublicId: string;
      goodsMinor: number;
      commissionMinor: number;
      deliveryMinor: number;
      netMinor: number;
    }>;
    commissionMinor?: number;
  };
}): Promise<void> {
  const { supabase, orderIds, amountMinor, reference, feeQuote } = input;

  type VendorSplit = {
    vendorPublicId: string;
    goodsMinor: number;
    commissionMinor: number;
    netMinor: number;
  };

  let splits: VendorSplit[] = [];

  if (feeQuote?.byVendor?.length) {
    splits = feeQuote.byVendor
      .filter((v) => v.vendorPublicId && v.netMinor > 0)
      .map((v) => ({
        vendorPublicId: v.vendorPublicId,
        goodsMinor: v.goodsMinor,
        commissionMinor: v.commissionMinor,
        netMinor: v.netMinor,
      }));
  } else {
    const { data: orders } = await supabase
      .from("orders")
      .select("public_id, vendor_id, total_minor, subtotal_minor")
      .in("public_id", orderIds);

    const byVendor = new Map<string, number>();
    for (const o of orders || []) {
      const vid = o.vendor_id ? String(o.vendor_id) : "";
      if (!vid) continue;
      const goods = Math.round(
        Number(o.subtotal_minor ?? o.total_minor ?? 0),
      );
      if (goods <= 0) continue;
      byVendor.set(vid, (byVendor.get(vid) || 0) + goods);
    }

    // Fallback: order_items if orders lack vendor totals
    if (!byVendor.size) {
      const { data: items } = await supabase
        .from("order_items")
        .select("vendor_public_id, line_total_minor, unit_price_minor, quantity")
        .in("order_public_id", orderIds);
      for (const it of items || []) {
        const vid = it.vendor_public_id ? String(it.vendor_public_id) : "";
        if (!vid) continue;
        const line =
          it.line_total_minor != null
            ? Math.round(Number(it.line_total_minor))
            : Math.round(
                Number(it.unit_price_minor || 0) * Number(it.quantity || 0),
              );
        if (line <= 0) continue;
        byVendor.set(vid, (byVendor.get(vid) || 0) + line);
      }
    }

    for (const [vendorPublicId, goodsMinor] of byVendor) {
      const commissionMinor = Math.round(
        (goodsMinor * DEFAULT_COMMISSION_BPS) / 10_000,
      );
      const netMinor = Math.max(0, goodsMinor - commissionMinor);
      if (netMinor <= 0) continue;
      splits.push({
        vendorPublicId,
        goodsMinor,
        commissionMinor,
        netMinor,
      });
    }
  }

  if (!splits.length) return;

  const totalNet = splits.reduce((s, v) => s + v.netMinor, 0);
  const totalFee = splits.reduce((s, v) => s + v.commissionMinor, 0);
  const allocate = totalNet + totalFee;
  if (allocate <= 0) return;

  // Cap allocation to captured amount (fees may leave remainder in clearing)
  const scale =
    allocate > amountMinor && allocate > 0 ? amountMinor / allocate : 1;

  const legs: {
    accountCode: string;
    amountMinor: number;
    vendorPublicId?: string | null;
    ownerType?: string;
  }[] = [
    {
      accountCode: "revenue_clearing",
      amountMinor: Math.round(allocate * scale),
      ownerType: "platform",
    },
  ];

  for (const s of splits) {
    const net = Math.round(s.netMinor * scale);
    if (net <= 0) continue;
    legs.push({
      accountCode: `vendor_payable_${s.vendorPublicId}`,
      amountMinor: -net,
      vendorPublicId: s.vendorPublicId,
      ownerType: "vendor",
    });
  }

  const fee = Math.round(totalFee * scale);
  if (fee > 0) {
    legs.push({
      accountCode: "platform_fees",
      amountMinor: -fee,
      ownerType: "platform",
    });
  }

  // Fix rounding so legs balance
  const sum = legs.reduce((a, l) => a + l.amountMinor, 0);
  if (sum !== 0) {
    legs[0] = {
      ...legs[0],
      amountMinor: legs[0].amountMinor - sum,
    };
  }

  await postLedgerTransaction({
    type: "vendor_payable_allocate",
    referenceType: "paystack",
    referenceId: null,
    idempotencyKey: `paystack:vendor_payable:${reference}`,
    legs,
  });
}
