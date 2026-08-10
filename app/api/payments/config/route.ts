import { NextResponse } from "next/server";
import { paystackConfigStatus } from "@/lib/paystack/client";
import { stripeConfigStatus } from "@/lib/stripe/client";

/** Public-safe dual-rail readiness check. */
export async function GET() {
  const paystack = paystackConfigStatus();
  const stripe = stripeConfigStatus();
  const stripeReady = stripe.configured;
  const paystackReady = paystack.configured;

  return NextResponse.json({
    data: {
      paystack: {
        ...paystack,
        ready: paystackReady,
      },
      stripe: {
        ...stripe,
        ready: stripeReady,
      },
      dualRail: true,
      methods: {
        stripe_checkout: stripeReady,
        paystack_card: paystackReady,
        mpesa: paystackReady,
        paystack_bank: paystackReady,
        paystack_ussd: paystackReady,
        /** @deprecated alias */
        stripe_card: stripeReady,
      },
      testHints: [
        "Stripe → card, Apple Pay, Google Pay, Link (Checkout Session)",
        "Paystack → card, M-Pesa, bank, USSD",
        "Vendor payouts release when order status → collected",
      ],
    },
  });
}
