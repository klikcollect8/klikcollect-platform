"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import DriverPageHeader from "@/components/driver/DriverPageHeader";

export default function DriverScanPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/driver/deliveries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barcode: code.trim(),
        status: "picked_up",
        pod: { scannedAt: new Date().toISOString(), barcode: code.trim() },
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      const id = j.data?.id as string | undefined;
      setMsg(`Picked up: ${j.data?.public_id || code}`);
      setCode("");
      if (id) {
        try {
          localStorage.setItem("klikcollect:driver-active-delivery", id);
        } catch {
          /* ignore */
        }
        router.push(`/driver?focus=${encodeURIComponent(id)}`);
      }
    } else {
      setMsg(j.error?.message || "Scan failed - no matching delivery");
    }
  };

  return (
    <div className="space-y-5">
      <DriverPageHeader
        eyebrow="Scan"
        title="Barcode pickup"
        subtitle="Confirm parcel pickup, then jump straight back to the live map."
      />

      <div className="rounded-[22px] bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.05]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-black/[0.04]">
          <ScanLine className="h-7 w-7 text-black/50" />
        </div>
        <input
          className="w-full rounded-2xl bg-black/[0.04] px-4 py-4 text-center text-[18px] font-semibold tracking-wide outline-none ring-black/10 transition focus:bg-white focus:ring-2"
          placeholder="Delivery id / barcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          autoFocus
        />
        <button
          type="button"
          disabled={busy || !code.trim()}
          onClick={() => void submit()}
          className="mt-4 w-full rounded-[18px] bg-[#111] px-4 py-4 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)] disabled:opacity-40"
        >
          {busy ? "Confirming…" : "Confirm pickup"}
        </button>
        {msg ? (
          <p className="mt-4 text-center text-[13px] font-medium text-black/55">
            {msg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
