import { getServiceSupabase } from "@/lib/supabase/admin";
import { getStripe, stripeCurrency } from "@/lib/stripe/client";

export type ConnectedAccountRow = {
  vendor_public_id: string;
  stripe_account_id: string;
  transfers_ready: boolean;
  details_submitted: boolean;
};

/**
 * Create or return existing Accounts v2 recipient account for a vendor.
 * dashboard: none — embedded components only.
 */
export async function ensureVendorConnectedAccount(input: {
  vendorPublicId: string;
  displayName: string;
  email?: string | null;
}): Promise<{ stripeAccountId: string; created: boolean }> {
  const sb = getServiceSupabase();
  const { data: existing } = await sb
    .from("stripe_connected_accounts")
    .select("stripe_account_id")
    .eq("vendor_public_id", input.vendorPublicId)
    .maybeSingle();
  if (existing?.stripe_account_id) {
    return { stripeAccountId: existing.stripe_account_id, created: false };
  }

  const stripe = getStripe();
  // Accounts v2 — recipient for separate charges & transfers
  const account = await stripe.v2.core.accounts.create({
    display_name: input.displayName.slice(0, 150),
    contact_email: input.email || undefined,
    dashboard: "none",
    identity: {
      country: process.env.STRIPE_CONNECT_COUNTRY || "KE",
    },
    defaults: {
      currency: stripeCurrency(),
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: {
      vendor_public_id: input.vendorPublicId,
    },
  } as never);

  const stripeAccountId = String(
    (account as { id?: string }).id || "",
  );
  if (!stripeAccountId) throw new Error("Stripe account create returned no id");

  const { error } = await sb.from("stripe_connected_accounts").insert({
    vendor_public_id: input.vendorPublicId,
    stripe_account_id: stripeAccountId,
    dashboard: "none",
    metadata: { display_name: input.displayName },
  });
  if (error) throw error;

  return { stripeAccountId, created: true };
}

export async function createAccountSession(stripeAccountId: string) {
  const stripe = getStripe();
  return stripe.accountSessions.create({
    account: stripeAccountId,
    components: {
      account_onboarding: { enabled: true },
      account_management: { enabled: true },
      notification_banner: { enabled: true },
      payments: { enabled: true },
      payouts: { enabled: true },
    },
  });
}

/** Sync capability flags from Stripe → DB. */
export async function syncConnectedAccount(stripeAccountId: string) {
  const stripe = getStripe();
  const account = await stripe.v2.core.accounts.retrieve(stripeAccountId, {
    include: [
      "configuration.recipient",
      "defaults",
      "identity",
      "requirements",
    ],
  } as never);

  const recipient = (
    account as {
      configuration?: {
        recipient?: {
          capabilities?: {
            stripe_balance?: {
              stripe_transfers?: { status?: string };
              payouts?: { status?: string };
            };
          };
        };
      };
    }
  ).configuration?.recipient;

  const transfersStatus =
    recipient?.capabilities?.stripe_balance?.stripe_transfers?.status || "";
  const transfersReady = transfersStatus === "active";

  const sb = getServiceSupabase();
  await sb
    .from("stripe_connected_accounts")
    .update({
      transfers_ready: transfersReady,
      details_submitted: Boolean(
        (account as { requirements?: { summary?: { minimum_deadline?: unknown } } })
          .requirements,
      ),
      requirements: (account as { requirements?: unknown }).requirements || {},
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", stripeAccountId);

  return { transfersReady, account };
}

export async function getVendorConnectedAccount(
  vendorPublicId: string,
): Promise<ConnectedAccountRow | null> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("stripe_connected_accounts")
    .select(
      "vendor_public_id, stripe_account_id, transfers_ready, details_submitted",
    )
    .eq("vendor_public_id", vendorPublicId)
    .maybeSingle();
  return (data as ConnectedAccountRow) || null;
}
