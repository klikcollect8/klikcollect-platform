import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import {
  initializeTransaction,
  paystackPublicKey,
  paystackConfigStatus,
  type PaymentChannel,
} from "@/lib/paystack/client";
import { clerkEmail } from "@/lib/auth/clerk-email";
import { normalizeKenyaPhone } from "@/lib/paystack/phone";
import { getOsOrder } from "@/lib/orders-store";
import {
  stripeConfigStatus,
  stripePublishableKey,
} from "@/lib/stripe/client";
import { createStripeCheckoutSession } from "@/lib/stripe/checkout";
import { quoteFees } from "@/lib/fees/engine";

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const body = await request.json();
    const clientAmount = Number(body?.amountMinor);
    const deliveryMinorClient = 0;
    let amountMinor = Number.isFinite(clientAmount) ? clientAmount : 0;
    const email =
      String(body?.email || "").trim() ||
      clerkEmail(user) ||
      "";
    const orderPublicId = body?.orderPublicId
      ? String(body.orderPublicId)
      : null;
    const orderIds: string[] = Array.isArray(body?.orderIds)
      ? body.orderIds.map(String)
      : orderPublicId
        ? [orderPublicId]
        : [];
    const methodRaw = String(body?.method || "card").toLowerCase();
    const providerRaw = String(body?.provider || "").toLowerCase();
    // Dual rail: stripe card/wallets | paystack card | mpesa | bank | ussd
    const method: "card" | "mpesa" | "bank" | "ussd" =
      methodRaw === "mpesa" || methodRaw === "mobile_money"
        ? "mpesa"
        : methodRaw === "bank" || methodRaw === "bank_transfer"
          ? "bank"
          : methodRaw === "ussd"
            ? "ussd"
            : "card";
    const provider: "stripe" | "paystack" =
      providerRaw === "paystack" ||
      method === "mpesa" ||
      method === "bank" ||
      method === "ussd"
        ? "paystack"
        : providerRaw === "stripe"
          ? "stripe"
          : method === "card" && providerRaw !== "paystack"
            ? "stripe"
            : "paystack";

    const phoneNormalized = body?.phone
      ? normalizeKenyaPhone(String(body.phone))
      : null;
    const areaKey = "pickup";
    const collectHub = body?.collectHub ? String(body.collectHub) : null;

    if (method === "mpesa" && !phoneNormalized) {
      return NextResponse.json(
        { error: "Valid Kenya M-Pesa phone required (+2547…)" },
        { status: 400 },
      );
    }

    // Server goods + checkout delivery. Never overwrite a higher client total with
    // goods-only (that undercharged delivery).
    if (orderIds.length > 0) {
      try {
        let serverGoods = 0;
        for (const id of orderIds) {
          const order = await getOsOrder(id);
          if (order?.totalMinor && order.totalMinor > 0) {
            serverGoods += order.totalMinor;
          }
        }
        if (serverGoods > 0) {
          amountMinor = Math.max(
            amountMinor,
            serverGoods + deliveryMinorClient,
          );
        }
      } catch {
        // keep client amount
      }
    }

    // Fee quote (commission + delivery). Customer pays goods + delivery.
    let feeQuote = null as Awaited<ReturnType<typeof quoteFees>> | null;
    try {
      const feeLines: Array<{
        vendorPublicId: string;
        goodsMinor: number;
        productPublicId?: string;
        categoryName?: string;
      }> = [];
      for (const id of orderIds) {
        const order = await getOsOrder(id);
        if (!order) continue;
        const goods = order.items.reduce(
          (s, i) =>
            s +
            (Number(i.moneyMinor) > 0
              ? Number(i.moneyMinor) * i.quantity
              : Math.round(Number(i.unitPrice || 0) * 100) * i.quantity),
          0,
        );
        const goodsMinor =
          goods > 0
            ? goods
            : Math.max(
                0,
                (order.totalMinor || 0) - (order.snapshot?.feeMinor || 0),
              );
        feeLines.push({
          vendorPublicId: order.vendorId,
          goodsMinor,
        });
      }
      if (feeLines.length) {
        feeQuote = await quoteFees({
          lines: feeLines,
          areaKey,
          collectHub,
          fulfilment: "pickup",
        });
        // Bump to fee-engine total when higher; never drop below client/checkout total.
        if (feeQuote.customerTotalMinor > amountMinor) {
          amountMinor = feeQuote.customerTotalMinor;
        }
      }
    } catch {
      // fee tables may not be migrated yet — charge order total
    }

    if (!email || !Number.isFinite(amountMinor) || amountMinor < 1) {
      return NextResponse.json(
        { error: "email and amountMinor required" },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }

    const reference = publicId("pay");
    const intentPublic = publicId("pi");
    const origin = request.nextUrl.origin;
    const supabase = getServiceSupabase();

    // ─── Stripe card (Checkout Session) ─────────────────────────────
    if (provider === "stripe" && method === "card") {
      const stripeStatus = stripeConfigStatus();
      if (!stripeStatus.configured) {
        return NextResponse.json({
          data: {
            reference,
            provider: "stripe",
            offline: true,
            config: stripeStatus,
            message:
              "Stripe keys not configured. Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
          },
        });
      }

      try {
        const session = await createStripeCheckoutSession({
          email,
          amountMinor: Math.round(amountMinor),
          reference,
          orderPublicId: orderPublicId || orderIds[0] || null,
          orderIds,
          origin,
          lineItems: body?.lineItems || [],
          callbackQuery: {
            fulfilment: "pickup",
            orderPublicId: orderPublicId || orderIds[0] || undefined,
          },
          cancelUrl: undefined,
        });

        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent &&
                typeof session.payment_intent === "object" &&
                "id" in session.payment_intent
              ? String(
                  (session.payment_intent as { id: string }).id,
                )
              : null;

        await supabase.from("payment_intents").insert({
          public_id: intentPublic,
          order_public_id: orderPublicId || orderIds[0] || null,
          clerk_user_id: user?.id || null,
          email,
          amount_minor: Math.round(amountMinor),
          paystack_reference: reference,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: piId,
          authorization_url: session.url,
          provider: "stripe",
          status: "pending",
          metadata: {
            method: "card",
            provider: "stripe",
            orderIds,
            lineItems: body?.lineItems || [],
            feeQuote,
            areaKey,
            collectHub,
            fulfilment: "pickup",
            returnPath: null,
          },
        });

        return NextResponse.json({
          data: {
            reference,
            provider: "stripe",
            method: "card",
            checkoutUrl: session.url,
            sessionId: session.id,
            publicKey: stripePublishableKey(),
            amountMinor: Math.round(amountMinor),
            feeQuote,
            returnPath: null,
          },
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Stripe init failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    // ─── Paystack (card / M-Pesa / bank / USSD) ─────────────────────
    const channels: PaymentChannel[] =
      method === "mpesa"
        ? ["mobile_money"]
        : method === "bank"
          ? ["bank"]
          : method === "ussd"
            ? ["ussd"]
            : ["card"];
    const callbackParams = new URLSearchParams({
      reference,
      provider: "paystack",
      fulfilment: "pickup",
    });
    const oid = orderPublicId || orderIds[0];
    if (oid) callbackParams.set("orderPublicId", oid);
    const callbackUrl = `${origin}/payment/callback?${callbackParams.toString()}`;

    const metadata: Record<string, unknown> = {
      orderPublicId: orderPublicId || orderIds[0] || null,
      orderIds,
      intentPublic,
      channel: method,
      paymentMethod: method,
      provider: "paystack",
      fulfilment: "pickup",
      returnPath: null,
    };
    if (phoneNormalized) metadata.phone = phoneNormalized;

    let paystack: Awaited<ReturnType<typeof initializeTransaction>>;
    try {
      paystack = await initializeTransaction({
        email,
        amountMinor: Math.round(amountMinor),
        reference,
        callbackUrl,
        channels,
        metadata,
        phone: phoneNormalized || undefined,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Paystack init failed";
      if (message.includes("Missing PAYSTACK")) {
        await supabase.from("payment_intents").insert({
          public_id: intentPublic,
          order_public_id: orderPublicId || orderIds[0] || null,
          clerk_user_id: user?.id || null,
          email,
          amount_minor: Math.round(amountMinor),
          paystack_reference: reference,
          provider: "paystack",
          status: "pending",
          metadata: {
            offline: true,
            method,
            phone: phoneNormalized,
            orderIds,
          },
        });
        return NextResponse.json({
          data: {
            reference,
            provider: "paystack",
            authorizationUrl: null,
            accessCode: null,
            publicKey: paystackPublicKey(),
            offline: true,
            config: paystackConfigStatus(),
            message:
              "Paystack keys not configured. Set PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env.local",
          },
        });
      }
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const { error: insertErr } = await supabase.from("payment_intents").insert({
      public_id: intentPublic,
      order_public_id: orderPublicId || orderIds[0] || null,
      clerk_user_id: user?.id || null,
      email,
      amount_minor: Math.round(amountMinor),
      paystack_reference: paystack.reference,
      paystack_access_code: paystack.access_code,
      authorization_url: paystack.authorization_url,
      provider: "paystack",
      status: "pending",
      metadata: {
        method,
        channels,
        phone: phoneNormalized,
        orderIds,
        lineItems: body?.lineItems || [],
        feeQuote,
        fulfilment: "pickup",
        returnPath: null,
      },
    });

    if (insertErr) {
      return NextResponse.json(
        { error: `Could not save payment intent: ${insertErr.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        reference: paystack.reference,
        provider: "paystack",
        authorizationUrl: paystack.authorization_url,
        accessCode: paystack.access_code,
        publicKey: paystackPublicKey(),
        amountMinor: Math.round(amountMinor),
        method,
        feeQuote,
        returnPath: null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Initialize failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
