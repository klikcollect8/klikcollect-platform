"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy /checkout route — opens the Cart-style checkout popup
 * via Header's `openCheckout` event, then returns to the bag.
 */
export default function CheckoutPage() {
  const router = useRouter();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("openCheckout"));
    router.replace("/cart");
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f7f5]">
      <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
        Opening checkout
      </p>
    </div>
  );
}
