import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function stripeSecretKey(): string {
  const live = process.env.STRIPE_LIVE_ENABLED === "true";
  const key =
    (live ? process.env.STRIPE_SECRET_KEY : null) ||
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_TEST_SECRET_KEY ||
    "";
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY / STRIPE_TEST_SECRET_KEY");
  return key;
}

export function stripePublishableKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    null
  );
}

/** Checkout / transfer currency. Override via STRIPE_CURRENCY (default kes). */
export function stripeCurrency(): string {
  return (process.env.STRIPE_CURRENCY || "kes").toLowerCase();
}

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  stripeSingleton = new Stripe(stripeSecretKey(), {
    apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
    typescript: true,
  });
  return stripeSingleton;
}

export function stripeConfigStatus() {
  let secret = "";
  try {
    secret = stripeSecretKey();
  } catch {
    secret = "";
  }
  const publishable = stripePublishableKey() || "";
  const secretMode = secret.startsWith("sk_live_")
    ? "live"
    : secret.startsWith("rk_live_")
      ? "restricted_live"
      : secret.startsWith("sk_test_")
        ? "test"
        : secret.startsWith("rk_test_")
          ? "restricted_test"
          : secret.startsWith("rk_")
            ? "restricted"
            : secret
              ? "unknown"
              : "missing";
  return {
    configured: Boolean(secret && publishable),
    secretMode,
    publishableConfigured: Boolean(publishable),
    currency: stripeCurrency(),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    liveEnabled: process.env.STRIPE_LIVE_ENABLED === "true",
    // Prefer restricted keys (rk_) over sk_ for server use
    usingRestrictedKey: secret.startsWith("rk_"),
  };
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return secret;
}
