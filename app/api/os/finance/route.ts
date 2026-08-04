import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import {
  listPayouts,
  listSettlements,
  listVendorLedgerTransactions,
} from "@/lib/ledger/post";
import { getVendorPayableBalance } from "@/lib/ledger/balances";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { publicId } from "@/lib/ids";
import { createTransferRecipient } from "@/lib/paystack/client";
import { hasPermission } from "@/lib/authz/can";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("ledger:view", {
    vendorId: vendorId || undefined,
  });
  if (!gate.ok) return gate.response;

  const scope = vendorId || gate.actor.vendorIds[0];
  if (vendorId && !gate.actor.vendorIds.includes(vendorId)) {
    return NextResponse.json(
      { error: { message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const sb = getServiceSupabase();

  async function scopedReceipts() {
    if (!scope) return [];
    // Prefer vendor_public_id when present; fall back to order → vendor join.
    const byVendor = await sb
      .from("payment_receipts")
      .select(
        "public_id, amount_minor, channel, paid_at, order_public_id, vendor_public_id",
      )
      .eq("vendor_public_id", scope)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!byVendor.error && (byVendor.data?.length || 0) > 0) {
      return byVendor.data || [];
    }

    const { data: vendor } = await sb
      .from("vendors")
      .select("id")
      .eq("public_id", scope)
      .maybeSingle();
    if (!vendor) return [];

    const { data: orders } = await sb
      .from("orders")
      .select("public_id")
      .eq("vendor_id", vendor.id)
      .limit(100);
    const orderIds = (orders || []).map((o) => o.public_id).filter(Boolean);
    if (!orderIds.length) return [];

    const { data: receipts } = await sb
      .from("payment_receipts")
      .select(
        "public_id, amount_minor, channel, paid_at, order_public_id, vendor_public_id",
      )
      .in("order_public_id", orderIds)
      .order("created_at", { ascending: false })
      .limit(20);
    return receipts || [];
  }

  const [
    settlements,
    payouts,
    transactions,
    availableMinor,
    recipients,
    receipts,
  ] = await Promise.all([
    listSettlements(scope),
    listPayouts(scope),
    scope ? listVendorLedgerTransactions(scope, 40) : Promise.resolve([]),
    scope ? getVendorPayableBalance(scope) : Promise.resolve(0),
    scope
      ? sb
          .from("transfer_recipients")
          .select(
            "id, recipient_code, type, name, currency_code, active, details",
          )
          .eq("vendor_public_id", scope)
          .eq("active", true)
          .then((r) => r.data || [])
      : Promise.resolve([]),
    scopedReceipts(),
  ]);

  return NextResponse.json({
    data: {
      vendorId: scope,
      settlements,
      payouts,
      transactions,
      availableMinor,
      recipients,
      receipts,
      canWithdraw: hasPermission(gate.actor.actor, "finance:withdraw", {
        vendorId: scope,
      }),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const action = String(body?.action || "withdraw");
  const vendorId = String(body?.vendorId || "");

  if (action === "register_recipient") {
    const gate = await requireVendorPermission("finance:withdraw", {
      vendorId,
    });
    if (!gate.ok) return gate.response;

    const name = String(body?.name || "").trim();
    const accountNumber = String(body?.accountNumber || "").trim();
    const bankCode = String(body?.bankCode || "").trim();
    const type = String(body?.type || "mobile_money") as
      | "mobile_money"
      | "nuban"
      | "basa";

    if (!name || !accountNumber || !bankCode) {
      return NextResponse.json(
        { error: { message: "name, accountNumber, bankCode required" } },
        { status: 400 },
      );
    }

    try {
      const recipient = await createTransferRecipient({
        type,
        name,
        accountNumber,
        bankCode,
      });
      const { data, error } = await getServiceSupabase()
        .from("transfer_recipients")
        .insert({
          vendor_public_id: vendorId,
          recipient_code: recipient.recipient_code,
          type: recipient.type || type,
          name: recipient.name || name,
          currency_code: "KES",
          details: recipient.details || { accountNumber, bankCode },
          active: true,
        })
        .select("*")
        .single();
      if (error) {
        return NextResponse.json(
          { error: { message: error.message } },
          { status: 500 },
        );
      }
      await emitVendorActivity({
        vendorPublicId: vendorId,
        kind: "payment",
        title: "Payout recipient saved",
        body: name,
        refType: "transfer_recipient",
        refId: data.recipient_code,
      });
      await notifyVendorStaff({
        vendorPublicId: vendorId,
        title: "Payout recipient saved",
        body: name,
        href: "/app/finance",
        roles: ["vendor_owner", "vendor_admin", "finance_manager"],
      });
      return NextResponse.json({ data });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Recipient failed";
      return NextResponse.json({ error: { message } }, { status: 502 });
    }
  }

  const gate = await requireVendorPermission("finance:withdraw", { vendorId });
  if (!gate.ok) return gate.response;

  const amountMinor = Number(body?.amountMinor || 0);
  if (!vendorId || amountMinor < 1) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID",
          message: "vendorId and amountMinor required",
        },
      },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();
  const available = await getVendorPayableBalance(vendorId);
  if (amountMinor > available) {
    return NextResponse.json(
      {
        error: {
          code: "INSUFFICIENT",
          message: `Available balance is ${(available / 100).toFixed(2)} KES`,
        },
      },
      { status: 400 },
    );
  }

  const { data: frozen } = await supabase
    .from("kyc_submissions")
    .select("payouts_frozen")
    .eq("vendor_public_id", vendorId)
    .eq("payouts_frozen", true)
    .maybeSingle();
  if (frozen) {
    return NextResponse.json(
      { error: { code: "FROZEN", message: "Payouts frozen" } },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("payouts")
    .insert({
      public_id: publicId("po"),
      vendor_public_id: vendorId,
      amount_minor: amountMinor,
      idempotency_key: `wd:${vendorId}:${Date.now()}`,
      status: "pending",
      created_by_clerk_user_id: gate.actor.userId,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: { message: error.message } },
      { status: 500 },
    );
  }

  await emitVendorActivity({
    vendorPublicId: vendorId,
    kind: "payment",
    title: "Withdrawal requested",
    body: `${(amountMinor / 100).toFixed(2)} KES pending`,
    refType: "payout",
    refId: data.public_id,
    meta: { amountMinor },
  });
  await notifyVendorStaff({
    vendorPublicId: vendorId,
    title: "Withdrawal requested",
    body: `${(amountMinor / 100).toFixed(2)} KES · pending review`,
    href: "/app/finance",
  });

  return NextResponse.json({ data });
}
