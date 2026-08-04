"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Confirming your order…");

  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref") || "";
    const provider = params.get("provider") || undefined;
    const sessionId = params.get("session_id") || undefined;
    if (!reference) {
      setStatus("Missing payment reference");
      router.replace("/account/orders");
      return;
    }

    void fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, provider, session_id: sessionId }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.receiptPublicId) {
          setStatus("Order received");
          router.replace(`/account/receipts/${j.data.receiptPublicId}`);
          return;
        }
        setStatus(
          j.data?.status === "success" ? "Order received" : "Payment recorded",
        );
        router.replace("/account/orders");
      })
      .catch(() => {
        setStatus("Verification failed");
        router.replace("/account/orders");
      });
  }, [params, router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f7f7f5] px-6 text-center">
      <p className="text-[22px] font-semibold tracking-tight">{status}</p>
      <p className="mt-3 max-w-xs text-[14px] text-black/45">
        Hang tight — we&apos;re confirming payment and preparing your pickup
        details.
      </p>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#f7f7f5] px-6 text-center">
          <p className="text-[22px] font-semibold tracking-tight">
            Confirming your order…
          </p>
          <p className="mt-3 max-w-xs text-[14px] text-black/45">
            Hang tight — we&apos;re confirming payment and preparing your pickup
            details.
          </p>
        </div>
      }
    >
      <PaymentCallbackInner />
    </Suspense>
  );
}
