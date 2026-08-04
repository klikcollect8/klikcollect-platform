import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminPermission,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import {
  createRefund,
  fetchPaystackBalance,
  listTransactions,
  listTransfers,
  paystackConfigStatus,
  verifyTransaction,
} from "@/lib/paystack/client";
import { captureSuccessfulPayment } from "@/lib/payments/capture";
import { postLedgerTransaction } from "@/lib/ledger/post";
import { listPlatformBalances } from "@/lib/ledger/balances";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdminPermission("payments:view");

    const config = paystackConfigStatus();
    const sb = getServiceSupabase();

    const [
      balancesLocal,
      intents,
      receipts,
      webhooks,
      paystackBalance,
      paystackTx,
      paystackTransfers,
    ] = await Promise.all([
      listPlatformBalances().catch(() => []),
      sb
        .from("payment_intents")
        .select(
          "public_id, amount_minor, status, email, paystack_reference, order_public_id, metadata, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(30)
        .then((r) => r.data || []),
      sb
        .from("payment_receipts")
        .select(
          "public_id, amount_minor, channel, customer_email, paystack_reference, paid_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(25)
        .then((r) => r.data || []),
      sb
        .from("webhook_events")
        .select("event_id, event_type, processed, error, created_at")
        .eq("provider", "paystack")
        .order("created_at", { ascending: false })
        .limit(25)
        .then((r) => r.data || []),
      config.secretConfigured
        ? fetchPaystackBalance().catch((e: unknown) => ({
            error: e instanceof Error ? e.message : "Balance fetch failed",
          }))
        : Promise.resolve({ error: "Secret key not configured" }),
      config.secretConfigured
        ? listTransactions({ perPage: 25 }).catch((e: unknown) => ({
            error: e instanceof Error ? e.message : "Transactions fetch failed",
          }))
        : Promise.resolve({ error: "Secret key not configured" }),
      config.secretConfigured
        ? listTransfers({ perPage: 15 }).catch((e: unknown) => ({
            error: e instanceof Error ? e.message : "Transfers fetch failed",
          }))
        : Promise.resolve({ error: "Secret key not configured" }),
    ]);

    const asError = (value: unknown): string | null =>
      !Array.isArray(value) &&
      typeof value === "object" &&
      value &&
      "error" in value
        ? String((value as { error: string }).error)
        : null;

    return NextResponse.json({
      data: {
        config,
        health: {
          secretOk: config.secretConfigured,
          publicOk: Boolean(config.publicKeyMasked !== "(not set)"),
          webhookOk:
            config.webhookSecretConfigured || config.webhookHmacFallback,
          apiReachable: Array.isArray(paystackBalance),
          modeMismatch:
            config.secretMode !== "missing" &&
            config.publicMode !== "missing" &&
            config.secretMode !== config.publicMode,
        },
        paystackBalance: Array.isArray(paystackBalance) ? paystackBalance : [],
        paystackBalanceError: asError(paystackBalance),
        paystackTransactions: Array.isArray(paystackTx) ? paystackTx : [],
        paystackTransactionsError: asError(paystackTx),
        paystackTransfers: Array.isArray(paystackTransfers)
          ? paystackTransfers
          : [],
        paystackTransfersError: asError(paystackTransfers),
        localBalances: balancesLocal,
        paymentIntents: intents,
        receipts,
        webhooks,
      },
    });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "verify" || action === "sync_capture") {
      await requireAdminPermission("payments:view");
      const reference = String(body?.reference || "").trim();
      if (!reference) {
        return NextResponse.json(
          { error: "reference required" },
          { status: 400 },
        );
      }

      try {
        const verified = await verifyTransaction(reference);
        if (action === "verify") {
          return NextResponse.json({
            data: {
              reference: verified.reference,
              status: verified.status,
              amount: verified.amount,
              currency: verified.currency,
              customer: verified.customer || null,
              metadata: verified.metadata || null,
            },
          });
        }

        if (verified.status !== "success") {
          return NextResponse.json(
            {
              error: `Cannot capture - Paystack status is ${verified.status}`,
              data: verified,
            },
            { status: 409 },
          );
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
        });

        return NextResponse.json({
          data: {
            reference,
            status: verified.status,
            amount: verified.amount,
            receiptPublicId: capture.receiptPublicId,
            already: Boolean((capture as { already?: boolean }).already),
          },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Paystack verify failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    if (action === "refund") {
      await requireAdminPermission("payments:refund");
      const reference = String(body?.reference || "").trim();
      const amountMinor = body?.amountMinor
        ? Number(body.amountMinor)
        : undefined;
      if (!reference) {
        return NextResponse.json(
          { error: "reference required" },
          { status: 400 },
        );
      }

      try {
        const refund = await createRefund({
          transaction: reference,
          amountMinor,
        });

        const amt = amountMinor || 0;
        if (amt > 0) {
          await postLedgerTransaction({
            type: "payment_refund",
            referenceType: "paystack_refund",
            idempotencyKey: `refund:${reference}:${amt}`,
            legs: [
              {
                accountCode: "revenue_clearing",
                amountMinor: amt,
                ownerType: "platform",
              },
              {
                accountCode: "cash_paystack",
                amountMinor: -amt,
                ownerType: "platform",
              },
            ],
          });
        }

        return NextResponse.json({ data: refund });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Refund failed";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}
