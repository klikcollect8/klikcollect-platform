import { NextRequest, NextResponse } from "next/server";
import { getStripe, stripeWebhookSecret } from "@/lib/stripe/client";
import { captureSuccessfulPayment } from "@/lib/payments/capture";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { syncConnectedAccount } from "@/lib/stripe/connect";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const sb = getServiceSupabase();
  await sb.from("webhook_events").upsert(
    {
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    },
    { onConflict: "provider,event_id" },
  );

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || event.type.includes("async")) {
        const reference =
          session.metadata?.reference ||
          session.client_reference_id ||
          session.id;
        const amountMinor = Number(session.amount_total || 0);
        const pi =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null;

        await captureSuccessfulPayment({
          reference,
          amountMinor,
          channel: "card",
          customerEmail: session.customer_details?.email || session.customer_email,
          orderPublicId: session.metadata?.orderPublicId || null,
          provider: "stripe",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: pi,
        });
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const reference = pi.metadata?.reference || pi.id;
      await captureSuccessfulPayment({
        reference,
        amountMinor: pi.amount_received || pi.amount,
        channel: "card",
        customerEmail: null,
        orderPublicId: pi.metadata?.orderPublicId || null,
        provider: "stripe",
        stripePaymentIntentId: pi.id,
      });
    }

    if (
      event.type === "account.updated" ||
      String(event.type).includes("account.updated")
    ) {
      const accountId =
        typeof event.data.object === "object" &&
        event.data.object &&
        "id" in event.data.object
          ? String((event.data.object as { id: string }).id)
          : "";
      if (accountId.startsWith("acct_")) {
        await syncConnectedAccount(accountId);
      }
    }

    await sb
      .from("webhook_events")
      .update({ processed: true })
      .eq("provider", "stripe")
      .eq("event_id", event.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook handler failed";
    await sb
      .from("webhook_events")
      .update({ error: message, processed: false })
      .eq("provider", "stripe")
      .eq("event_id", event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
