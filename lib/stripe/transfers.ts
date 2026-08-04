import { getServiceSupabase } from "@/lib/supabase/admin";
import { getStripe, stripeCurrency } from "@/lib/stripe/client";
import { getVendorConnectedAccount, syncConnectedAccount } from "@/lib/stripe/connect";
import { publicId } from "@/lib/ids";
import type { FeeQuote } from "@/lib/fees/engine";

/** Create pending transfer intents after successful Stripe capture. */
export async function createPendingVendorTransfers(input: {
  orderIds: string[];
  paymentIntentPublicId: string;
  feeQuote: FeeQuote;
  currency?: string;
}) {
  const sb = getServiceSupabase();
  const currency = (input.currency || stripeCurrency()).toUpperCase();
  const rows = [];

  for (const vendor of input.feeQuote.byVendor) {
    if (vendor.netMinor <= 0) continue;
    // Map vendor → primary order id if multi-order
    const orderPublicId =
      input.orderIds.find((id) => id.includes(vendor.vendorPublicId)) ||
      input.orderIds[0] ||
      "unknown";
    const idempotencyKey = `xfer:${input.paymentIntentPublicId}:${vendor.vendorPublicId}`;
    rows.push({
      public_id: publicId("vti"),
      order_public_id: orderPublicId,
      vendor_public_id: vendor.vendorPublicId,
      payment_intent_public_id: input.paymentIntentPublicId,
      goods_minor: vendor.goodsMinor,
      commission_minor: vendor.commissionMinor,
      delivery_minor: 0,
      net_minor: vendor.netMinor,
      currency_code: currency.slice(0, 3),
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: { orderIds: input.orderIds },
    });
  }

  if (!rows.length) return [];
  const { error } = await sb.from("vendor_transfer_intents").upsert(rows, {
    onConflict: "idempotency_key",
    ignoreDuplicates: true,
  });
  if (error) throw error;
  return rows;
}

/** Mark transfers ready when order is collected; execute Stripe transfers. */
export async function releaseTransfersForOrder(orderPublicId: string) {
  const sb = getServiceSupabase();
  const { data: intents } = await sb
    .from("vendor_transfer_intents")
    .select("*")
    .eq("order_public_id", orderPublicId)
    .in("status", ["pending", "ready", "failed"]);

  // Also match by metadata orderIds containing this id
  const { data: metaIntents } = await sb
    .from("vendor_transfer_intents")
    .select("*")
    .contains("metadata", { orderIds: [orderPublicId] })
    .in("status", ["pending", "ready", "failed"]);

  const all = [...(intents || []), ...(metaIntents || [])];
  const byId = new Map(all.map((r) => [r.id, r]));
  const results = [];

  for (const intent of byId.values()) {
    results.push(await executeVendorTransfer(String(intent.id)));
  }
  return results;
}

export async function executeVendorTransfer(intentId: string) {
  const sb = getServiceSupabase();
  const { data: intent } = await sb
    .from("vendor_transfer_intents")
    .select("*")
    .eq("id", intentId)
    .maybeSingle();
  if (!intent) return { ok: false, error: "not_found" };
  if (intent.status === "transferred") return { ok: true, already: true };

  const connected = await getVendorConnectedAccount(intent.vendor_public_id);
  if (!connected) {
    await sb
      .from("vendor_transfer_intents")
      .update({
        status: "failed",
        error: "Vendor has no Stripe connected account",
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);
    return { ok: false, error: "no_connected_account" };
  }

  const synced = await syncConnectedAccount(connected.stripe_account_id);
  if (!synced.transfersReady) {
    await sb
      .from("vendor_transfer_intents")
      .update({
        status: "ready",
        error: "Transfers capability not active yet",
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);
    return { ok: false, error: "capability_pending" };
  }

  const stripe = getStripe();
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(Number(intent.net_minor)),
        currency: String(intent.currency_code || stripeCurrency()).toLowerCase(),
        destination: connected.stripe_account_id,
        transfer_group: intent.payment_intent_public_id || intent.order_public_id,
        metadata: {
          vendor_public_id: intent.vendor_public_id,
          order_public_id: intent.order_public_id,
          intent_public_id: intent.public_id,
        },
      },
      { idempotencyKey: intent.idempotency_key },
    );

    await sb
      .from("vendor_transfer_intents")
      .update({
        status: "transferred",
        stripe_transfer_id: transfer.id,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);

    return { ok: true, transferId: transfer.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transfer failed";
    await sb
      .from("vendor_transfer_intents")
      .update({
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id);
    return { ok: false, error: message };
  }
}
