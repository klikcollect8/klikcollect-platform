import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/paystack/client";
import { captureSuccessfulPayment } from "@/lib/payments/capture";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { retrieveCheckoutSession } from "@/lib/stripe/checkout";

type IntentMeta = {
  source?: string | null;
  fulfilment?: string | null;
  returnPath?: string | null;
  orderIds?: string[];
  lineItems?: unknown[];
};

function enrichVerify(input: {
  reference: string;
  status: string;
  amount: number;
  receiptPublicId: string | null;
  provider: "stripe" | "paystack";
  orderPublicId?: string | null;
  meta?: IntentMeta | null;
}) {
  const meta = input.meta || {};
  const orderPublicId =
    input.orderPublicId ||
    (Array.isArray(meta.orderIds) ? meta.orderIds[0] : null) ||
    null;

  return {
    reference: input.reference,
    status: input.status,
    amount: input.amount,
    receiptPublicId: input.receiptPublicId,
    provider: input.provider,
    orderPublicId,
    fulfilment: "pickup" as const,
    returnPath: meta.returnPath || null,
  };
}

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
    return enrichVerify({
      reference,
      status: "pending",
      amount: 0,
      receiptPublicId: null,
      provider: "stripe",
    });
  }

  const session = await retrieveCheckoutSession(sessionIdResolved);
  const paid =
    session.payment_status === "paid" || session.status === "complete";

  const { data: intent } = await sb
    .from("payment_intents")
    .select("metadata, clerk_user_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  const meta =
    intent?.metadata && typeof intent.metadata === "object"
      ? (intent.metadata as IntentMeta)
      : null;

  if (!paid) {
    return enrichVerify({
      reference,
      status: session.payment_status || session.status || "pending",
      amount: session.amount_total || 0,
      receiptPublicId: null,
      provider: "stripe",
      orderPublicId: session.metadata?.orderPublicId || null,
      meta,
    });
  }

  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent &&
          typeof session.payment_intent === "object" &&
          "id" in session.payment_intent
        ? String((session.payment_intent as { id: string }).id)
        : null;

  const lineItems =
    meta && Array.isArray(meta.lineItems) ? meta.lineItems : [];

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

  return enrichVerify({
    reference,
    status: "success",
    amount: session.amount_total || 0,
    receiptPublicId: capture.receiptPublicId,
    provider: "stripe",
    orderPublicId: session.metadata?.orderPublicId || null,
    meta,
  });
}

async function verifyPaystack(reference: string) {
  const verified = await verifyTransaction(reference);
  const success = verified.status === "success";

  const { data: intent } = await getServiceSupabase()
    .from("payment_intents")
    .select("metadata, clerk_user_id, order_public_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  const meta =
    intent?.metadata && typeof intent.metadata === "object"
      ? (intent.metadata as IntentMeta)
      : null;

  const orderPublicId =
    (typeof verified.metadata?.orderPublicId === "string"
      ? verified.metadata.orderPublicId
      : null) ||
    intent?.order_public_id ||
    null;

  if (!success) {
    return enrichVerify({
      reference,
      status: verified.status,
      amount: verified.amount,
      receiptPublicId: null,
      provider: "paystack",
      orderPublicId,
      meta,
    });
  }

  const channel =
    (verified as { channel?: string }).channel ||
    (typeof verified.metadata?.channel === "string"
      ? verified.metadata.channel
      : null) ||
    "card";

  const lineItems =
    meta && Array.isArray(meta.lineItems) ? meta.lineItems : [];

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

  return enrichVerify({
    reference,
    status: verified.status,
    amount: verified.amount,
    receiptPublicId: capture.receiptPublicId,
    provider: "paystack",
    orderPublicId,
    meta,
  });
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
