import { NextRequest, NextResponse } from "next/server";
import { requireVendorActor } from "@/lib/auth/require-vendor";
import {
  createAccountSession,
  ensureVendorConnectedAccount,
  getVendorConnectedAccount,
  syncConnectedAccount,
} from "@/lib/stripe/connect";
import { stripeConfigStatus, stripePublishableKey } from "@/lib/stripe/client";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const vendorPublicId = gate.actor.vendorIds[0];
  if (!vendorPublicId) {
    return NextResponse.json(
      { error: "No vendor context" },
      { status: 400 },
    );
  }

  const status = stripeConfigStatus();
  const connected = await getVendorConnectedAccount(vendorPublicId);
  if (connected?.stripe_account_id) {
    try {
      await syncConnectedAccount(connected.stripe_account_id);
    } catch {
      /* ignore sync errors in GET */
    }
  }
  const refreshed = await getVendorConnectedAccount(vendorPublicId);

  return NextResponse.json({
    data: {
      config: status,
      publishableKey: stripePublishableKey(),
      connected: refreshed,
    },
  });
}

export async function POST(request: NextRequest) {
  const gate = await requireVendorActor();
  if (!gate.ok) return gate.response;

  const vendorPublicId = gate.actor.vendorIds[0];
  if (!vendorPublicId) {
    return NextResponse.json(
      { error: "No vendor context" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "session");

  const sb = getServiceSupabase();
  const { data: vendor } = await sb
    .from("vendors")
    .select("public_id, name")
    .eq("public_id", vendorPublicId)
    .maybeSingle();

  const displayName = vendor?.name || vendorPublicId;

  if (action === "ensure" || action === "session") {
    const { stripeAccountId } = await ensureVendorConnectedAccount({
      vendorPublicId,
      displayName,
      email: gate.actor.email || null,
    });

    if (action === "ensure") {
      return NextResponse.json({
        data: { stripeAccountId },
      });
    }

    const session = await createAccountSession(stripeAccountId);
    return NextResponse.json({
      data: {
        clientSecret: session.client_secret,
        stripeAccountId,
        publishableKey: stripePublishableKey(),
      },
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
