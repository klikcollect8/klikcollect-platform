import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { verifyPaystackSignature } from "@/lib/paystack/client";
import { captureSuccessfulPayment } from "@/lib/payments/capture";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    id?: number | string;
    event?: string;
    data?: {
      id?: number | string;
      reference?: string;
      amount?: number;
      status?: string;
      channel?: string;
      customer?: { email?: string };
      metadata?: { orderPublicId?: string };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const eventType = event.event || "unknown";
  // Stable idempotency: prefer data.id, then top-level id, then hash
  const eventId =
    event.data?.id != null
      ? String(event.data.id)
      : event.id != null
        ? String(event.id)
        : crypto
            .createHash("sha256")
            .update(`${eventType}:${event.data?.reference || raw}`)
            .digest("hex")
            .slice(0, 32);

  const { error } = await supabase.from("webhook_events").insert({
    provider: "paystack",
    event_id: eventId,
    event_type: eventType,
    payload: event,
    processed: false,
  });
  if (error?.code === "23505") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (eventType === "charge.success" && event.data?.reference) {
      await captureSuccessfulPayment({
        reference: event.data.reference,
        amountMinor: Number(event.data.amount || 0),
        channel: event.data.channel || "card",
        customerEmail: event.data.customer?.email || null,
        orderPublicId: event.data.metadata?.orderPublicId || null,
      });
    }

    await supabase
      .from("webhook_events")
      .update({ processed: true })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "process error";
    await supabase
      .from("webhook_events")
      .update({ error: message })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
  }

  return NextResponse.json({ ok: true });
}
