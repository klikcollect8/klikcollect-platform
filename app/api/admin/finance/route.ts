import { NextRequest, NextResponse } from "next/server";
import {
  requireAdminPermission,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import {
  listLedgerTransactions,
  listPayouts,
  listSettlements,
  postLedgerTransaction,
} from "@/lib/ledger/post";
import { listPlatformBalances } from "@/lib/ledger/balances";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { createRefund, initiateTransfer } from "@/lib/paystack/client";

export async function GET() {
  try {
    await requireAdminPermission("ledger:view");
    const [
      transactions,
      settlements,
      payouts,
      intents,
      balances,
      webhooks,
      receipts,
    ] = await Promise.all([
      listLedgerTransactions(80),
      listSettlements(),
      listPayouts(),
      getServiceSupabase()
        .from("payment_intents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40)
        .then((r) => r.data || []),
      listPlatformBalances(),
      getServiceSupabase()
        .from("webhook_events")
        .select("event_id, event_type, processed, error, created_at")
        .eq("provider", "paystack")
        .order("created_at", { ascending: false })
        .limit(20)
        .then((r) => r.data || []),
      getServiceSupabase()
        .from("payment_receipts")
        .select("public_id, amount_minor, channel, customer_email, paid_at")
        .order("created_at", { ascending: false })
        .limit(20)
        .then((r) => r.data || []),
    ]);
    return NextResponse.json({
      data: {
        transactions,
        settlements,
        payouts,
        paymentIntents: intents,
        balances,
        webhooks,
        receipts,
      },
    });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireAdminPermission("payments:payout");
    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "create_settlement") {
      await requireAdminPermission("finance:settlements");
      const vendorPublicId = String(body?.vendorPublicId || "");
      const netMinor = Number(body?.netMinor || 0);
      if (!vendorPublicId || netMinor <= 0) {
        return NextResponse.json(
          { error: "vendorPublicId and netMinor required" },
          { status: 400 },
        );
      }
      const supabase = getServiceSupabase();
      const { data, error } = await supabase
        .from("settlements")
        .insert({
          public_id: publicId("stl"),
          vendor_public_id: vendorPublicId,
          net_minor: netMinor,
          gross_minor: Number(body?.grossMinor || netMinor),
          fees_minor: Number(body?.feesMinor || 0),
          status: "ready",
        })
        .select("*")
        .single();
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "trigger_payout") {
      const vendorPublicId = String(body?.vendorPublicId || "");
      const amountMinor = Number(body?.amountMinor || 0);
      const recipientCode = String(body?.recipientCode || "");
      if (!vendorPublicId || amountMinor <= 0) {
        return NextResponse.json({ error: "Invalid payout" }, { status: 400 });
      }

      const supabase = getServiceSupabase();
      const { data: kyc } = await supabase
        .from("kyc_submissions")
        .select("payouts_frozen")
        .eq("vendor_public_id", vendorPublicId)
        .eq("payouts_frozen", true)
        .maybeSingle();
      if (kyc?.payouts_frozen) {
        return NextResponse.json(
          { error: "Payouts frozen for vendor" },
          { status: 403 },
        );
      }

      const payoutPublic = publicId("po");
      const idempotencyKey = String(
        body?.idempotencyKey || `payout:${payoutPublic}`,
      );

      const { data: payout, error } = await supabase
        .from("payouts")
        .insert({
          public_id: payoutPublic,
          vendor_public_id: vendorPublicId,
          amount_minor: amountMinor,
          idempotency_key: idempotencyKey,
          status: recipientCode ? "processing" : "pending",
          created_by_clerk_user_id: gate.user.id,
        })
        .select("*")
        .single();
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });

      if (recipientCode) {
        try {
          const transfer = await initiateTransfer({
            amountMinor,
            recipient: recipientCode,
            reference: payoutPublic,
            reason: "Vendor settlement",
          });
          await supabase
            .from("payouts")
            .update({
              status: "success",
              paystack_transfer_code: transfer.transfer_code,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payout.id);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Transfer failed";
          await supabase
            .from("payouts")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", payout.id);
          return NextResponse.json(
            { error: message, data: payout },
            { status: 502 },
          );
        }
      }

      await postLedgerTransaction({
        type: "vendor_payout",
        referenceType: "payout",
        idempotencyKey: `ledger:${idempotencyKey}`,
        legs: [
          {
            accountCode: `vendor_payable_${vendorPublicId}`,
            amountMinor,
            vendorPublicId,
            ownerType: "vendor",
          },
          {
            accountCode: "cash_paystack",
            amountMinor: -amountMinor,
            ownerType: "platform",
          },
        ],
      });

      return NextResponse.json({ data: payout });
    }

    if (action === "refund") {
      await requireAdminPermission("payments:refund");
      const reference = String(body?.reference || "");
      const amountMinor = body?.amountMinor
        ? Number(body.amountMinor)
        : undefined;
      if (!reference) {
        return NextResponse.json(
          { error: "reference required" },
          { status: 400 },
        );
      }
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
    }

    if (action === "create_settlement_from_balance") {
      await requireAdminPermission("finance:settlements");
      const vendorPublicId = String(body?.vendorPublicId || "");
      if (!vendorPublicId) {
        return NextResponse.json(
          { error: "vendorPublicId required" },
          { status: 400 },
        );
      }
      const { getVendorPayableBalance } = await import("@/lib/ledger/balances");
      const available = await getVendorPayableBalance(vendorPublicId);
      const netMinor = Number(body?.netMinor || available);
      if (netMinor <= 0) {
        return NextResponse.json(
          { error: "No payable balance for vendor" },
          { status: 400 },
        );
      }
      const supabase = getServiceSupabase();
      const { data, error } = await supabase
        .from("settlements")
        .insert({
          public_id: publicId("stl"),
          vendor_public_id: vendorPublicId,
          net_minor: netMinor,
          gross_minor: netMinor,
          fees_minor: 0,
          status: "ready",
        })
        .select("*")
        .single();
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return handleRequireAdminError(e) as NextResponse;
  }
}
