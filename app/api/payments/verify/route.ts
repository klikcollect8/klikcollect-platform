import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack/client";
import { captureSuccessfulPayment } from "@/lib/payments/capture";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { retrieveCheckoutSession } from "@/lib/stripe/checkout";

async function verifyStripe(reference: string, sessionId?: string | null) {
  const sb = getServiceSupabase();
  let sessionIdResolved = sessionId || null;

  if (!sessionIdResolved) {
    const { data: intent } = await sb
      .from("payment_intents")
      .select("stripe_checkout_session_id, metadata")
      .eq("paystack_reference", reference)
      .maybeSingle();
    sessionIdResolved = intent?.stripe_checkout_session_id || null;
  }

  if (!sessionIdResolved) {
    return {
      reference,
      status: "pending",
      amount: 0,
      receiptPublicId: null as string | null,
      provider: "stripe" as const,
    };
  }

  const session = await retrieveCheckoutSession(sessionIdResolved);
  const paid =
    session.payment_status === "paid" ||
    session.status === "complete";

  if (!paid) {
    return {
      reference,
      status: session.payment_status || session.status || "pending",
      amount: session.amount_total || 0,
      receiptPublicId: null as string | null,
      provider: "stripe" as const,
    };
  }

  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent &&
          typeof session.payment_intent === "object" &&
          "id" in session.payment_intent
        ? String((session.payment_intent as { id: string }).id)
        : null;

  const { data: intent } = await sb
    .from("payment_intents")
    .select("metadata, clerk_user_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  const lineItems =
    intent?.metadata &&
    typeof intent.metadata === "object" &&
    Array.isArray((intent.metadata as { lineItems?: unknown }).lineItems)
      ? (intent.metadata as { lineItems: unknown[] }).lineItems
      : [];

  const capture = await captureSuccessfulPayment({
    reference:
      session.metadata?.reference ||
      session.client_reference_id ||
      reference,
    amountMinor: Number(session.amount_total || 0),
    channel: "card",
    customerEmail:
      session.customer_details?.email || session.customer_email || null,
    orderPublicId: session.metadata?.orderPublicId || null,
    clerkUserId: intent?.clerk_user_id || null,
    lineItems,
    provider: "stripe",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: pi,
  });

  return {
    reference,
    status: "success",
    amount: session.amount_total || 0,
    receiptPublicId: capture.receiptPublicId,
    provider: "stripe" as const,
  };
}

async function verifyPaystack(reference: string) {
  const verified = await verifyTransaction(reference);
  const success = verified.status === "success";

  if (!success) {
    return {
      reference,
      status: verified.status,
      amount: verified.amount,
      receiptPublicId: null as string | null,
      provider: "paystack" as const,
    };
  }

  const channel =
    (verified as { channel?: string }).channel ||
    (typeof verified.metadata?.channel === "string"
      ? verified.metadata.channel
      : null) ||
    "card";

  const orderPublicId =
    typeof verified.metadata?.orderPublicId === "string"
      ? verified.metadata.orderPublicId
      : null;

  const { data: intent } = await getServiceSupabase()
    .from("payment_intents")
    .select("metadata, clerk_user_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  const lineItems =
    intent?.metadata &&
    typeof intent.metadata === "object" &&
    Array.isArray((intent.metadata as { lineItems?: unknown }).lineItems)
      ? (intent.metadata as { lineItems: unknown[] }).lineItems
      : [];

  const capture = await captureSuccessfulPayment({
    reference,
    amountMinor: verified.amount,
    channel,
    customerEmail: verified.customer?.email || null,
    orderPublicId,
    clerkUserId: intent?.clerk_user_id || null,
    lineItems,
    provider: "paystack",
  });

  return {
    reference,
    status: verified.status,
    amount: verified.amount,
    receiptPublicId: capture.receiptPublicId,
    provider: "paystack" as const,
  };
}

async function verifyAndCapture(
  reference: string,
  provider?: string | null,
  sessionId?: string | null,
) {
  const sb = getServiceSupabase();
  const { data: intent } = await sb
    .from("payment_intents")
    .select("provider, stripe_checkout_session_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  const resolved =
    provider ||
    intent?.provider ||
    (intent?.stripe_checkout_session_id ? "stripe" : "paystack");

  if (resolved === "stripe") {
    return verifyStripe(
      reference,
      sessionId || intent?.stripe_checkout_session_id,
    );
  }
  return verifyPaystack(reference);
}

export async function GET(request: NextRequest) {
  try {
    const reference = String(
      request.nextUrl.searchParams.get("reference") || "",
    ).trim();
    const provider = request.nextUrl.searchParams.get("provider");
    const sessionId = request.nextUrl.searchParams.get("session_id");
    if (!reference) {
      return NextResponse.json(
        { error: "reference required" },
        { status: 400 },
      );
    }
    const data = await verifyAndCapture(reference, provider, sessionId);
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verify failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reference = String(body?.reference || "").trim();
    if (!reference) {
      return NextResponse.json(
        { error: "reference required" },
        { status: 400 },
      );
    }
    const data = await verifyAndCapture(
      reference,
      body?.provider,
      body?.session_id || body?.sessionId,
    );
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verify failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
