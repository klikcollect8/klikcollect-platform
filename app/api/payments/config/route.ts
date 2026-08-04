import { NextResponse } from "next/server";
import { paystackConfigStatus } from "@/lib/paystack/client";
import { stripeConfigStatus } from "@/lib/stripe/client";

/** Public-safe dual-rail readiness check. */
export async function GET() {
  const paystack = paystackConfigStatus();
  const stripe = stripeConfigStatus();
  return NextResponse.json({
    data: {
      paystack: {
        ...paystack,
        ready: paystack.configured && paystack.secretMode === "test",
      },
      stripe: {
        ...stripe,
        ready: stripe.configured,
      },
      dualRail: true,
      methods: {
        card: stripe.configured ? "stripe" : paystack.configured ? "paystack" : null,
        mpesa: paystack.configured ? "paystack" : null,
      },
      testHints: [
        "Card → Stripe Checkout (test mode)",
        "M-Pesa → Paystack mobile_money",
        "Vendor payouts release when order status → collected",
      ],
    },
  });
}
