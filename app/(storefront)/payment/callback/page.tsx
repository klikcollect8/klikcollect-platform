"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState("Verifying payment…");

  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref") || "";
    const provider = params.get("provider") || undefined;
    const sessionId = params.get("session_id") || undefined;
    if (!reference) {
      setStatus("Missing reference");
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
          setStatus("Payment confirmed");
          router.replace(`/account/receipts/${j.data.receiptPublicId}`);
          return;
        }
        setStatus(
          j.data?.status === "success"
            ? "Payment confirmed"
            : "Payment recorded",
        );
        router.replace("/account/orders");
      })
      .catch(() => {
        setStatus("Verification failed");
        router.replace("/account/orders");
      });
  }, [params, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
      <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
        {status}
      </p>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
          <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
            Verifying payment…
          </p>
        </div>
      }
    >
      <PaymentCallbackInner />
    </Suspense>
  );
}
