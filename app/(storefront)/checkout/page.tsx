"use client";

import { Suspense } from "react";
import CheckoutWizard from "@/components/checkout/CheckoutWizard";

function CheckoutFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f5] text-[11px] uppercase tracking-[0.28em] text-black/40">
      Loading checkout
    </div>
  );
}

/**
 * Full-page dual-rail checkout (Stripe + Paystack).
 */
export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <CheckoutWizard />
    </Suspense>
  );
}
