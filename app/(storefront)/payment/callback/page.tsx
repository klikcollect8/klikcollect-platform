"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy Paystack callback — payments deferred to M3. */
export default function PaymentCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/account/orders");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
      <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">Redirecting</p>
    </div>
  );
}
