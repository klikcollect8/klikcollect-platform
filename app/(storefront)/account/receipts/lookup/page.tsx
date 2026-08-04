"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LookupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Finding receipt…");

  useEffect(() => {
    const ref = params.get("ref") || "";
    if (!ref) {
      setMsg("Missing reference");
      return;
    }
    void fetch(`/api/receipts?reference=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.public_id) {
          router.replace(`/account/receipts/${j.data.public_id}`);
        } else {
          setMsg(j.error || "Receipt not found");
        }
      })
      .catch(() => setMsg("Lookup failed"));
  }, [params, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
        {msg}
      </p>
    </div>
  );
}

export default function ReceiptLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">
            Finding receipt…
          </p>
        </div>
      }
    >
      <LookupInner />
    </Suspense>
  );
}
