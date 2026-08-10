"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintSheet, printSheet } from "@/components/os/PrintSheet";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  items: Array<{
    name: string;
    quantity: number;
    barcode?: string;
    productId?: string;
  }>;
  notes?: string;
  createdAt: string;
};

const PACKABLE = new Set(["pending", "confirmed", "preparing"]);

export default function PackingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = decodeURIComponent(String(params?.id || ""));
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [scan, setScan] = useState("");
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPrint, setCanPrint] = useState(false);
  const [storeName, setStoreName] = useState("Store");

  async function load() {
    const res = await fetch("/api/os/orders");
    const json = await res.json();
    const data = ((json.data || []) as Order[]).find((o) => o.id === orderId);
    if (!data || !PACKABLE.has(data.status)) {
      setMissing(true);
      setOrder(null);
      return;
    }
    setMissing(false);
    setOrder(data);
  }

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const perms: string[] = b?.data?.permissions || [];
        setCanPrint(perms.includes("orders:fulfill"));
      });
    void fetch("/api/os/dashboard")
      .then((r) => r.json())
      .then((b) => {
        if (b?.data?.storeName) setStoreName(String(b.data.storeName));
      })
      .catch(() => null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const lineKeys = useMemo(() => {
    if (!order) return [];
    return order.items.map((it, i) => `${it.productId || it.name}-${i}`);
  }, [order]);

  const allVerified =
    !!order && lineKeys.length > 0 && lineKeys.every((k) => verified.has(k));

  function verifyBarcode(raw: string) {
    if (!order) return;
    const code = raw.trim().toLowerCase();
    if (!code) return;
    const idx = order.items.findIndex((it) => {
      const barcode = (it.barcode || "").toLowerCase();
      const name = it.name.toLowerCase();
      return barcode === code || name.includes(code);
    });
    if (idx < 0) {
      setMessage("No matching line for that barcode");
      return;
    }
    const key = lineKeys[idx];
    setVerified((prev) => new Set(prev).add(key));
    setScan("");
    setMessage(`Verified · ${order.items[idx].name}`);
  }

  async function markPacked() {
    if (!order) return;
    setBusy(true);
    setMessage(null);
    try {
      const path: Record<string, string[]> = {
        pending: ["confirmed", "preparing", "ready"],
        confirmed: ["preparing", "ready"],
        preparing: ["ready"],
        ready: [],
      };
      const steps = path[order.status] || [];
      for (const status of steps) {
        const res = await fetch("/api/os/orders", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `pack-${order.id}-${status}-${Date.now()}`,
          },
          body: JSON.stringify({
            id: order.id,
            status,
            reason: "packed",
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setMessage(json?.error?.message || `Could not move to ${status}`);
          return;
        }
      }
      setMessage("Marked ready for collection");
      router.push("/app/orders/packing");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="space-y-6 py-10 text-center">
        <p className="text-[16px] font-medium">Order not available to pack</p>
        <Link href="/app/orders/packing" className={osUi.btnSecondary}>
          Back to queue
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <p className="py-16 text-center text-[14px] text-black/40">Loading…</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-32">
      <div className="flex items-start gap-3 print:hidden">
        <button
          type="button"
          onClick={() => router.push("/app/orders/packing")}
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center text-black/50 hover:text-black"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <div className="min-w-0">
          <p className={osUi.pageEyebrow}>{order.status}</p>
          <h1
            className="mt-1 text-[24px] font-medium tracking-tight sm:text-[28px]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-[14px] text-black/45">
            {order.customerName}
            {order.notes ? ` · ${order.notes}` : ""}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verifyBarcode(scan);
        }}
        className="flex flex-col gap-3 print:hidden sm:flex-row"
      >
        <input
          value={scan}
          onChange={(e) => setScan(e.target.value)}
          placeholder="Scan barcode to verify line"
          className={cn(osUi.input, "min-h-12 text-[18px]")}
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className={cn(osUi.btnSecondary, "min-h-12")}>
          Verify
        </button>
      </form>

      {message ? (
        <p className="text-[14px] font-medium text-black print:hidden">
          {message}
        </p>
      ) : null}

      <ul className="divide-y divide-black/10 border-y border-black/10 print:hidden">
        {order.items.map((it, i) => {
          const key = lineKeys[i];
          const ok = verified.has(key);
          return (
            <li
              key={key}
              className={cn(
                "flex min-h-[72px] items-center justify-between gap-4 py-4",
                ok ? "opacity-55" : "",
              )}
            >
              <div>
                <p className="text-[18px] font-medium leading-tight text-black sm:text-[20px]">
                  {it.quantity}× {it.name}
                </p>
                {it.barcode ? (
                  <p className={cn("mt-1 text-[13px] tabular-nums", osUi.muted)}>
                    {it.barcode}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() =>
                  setVerified((prev) => {
                    const next = new Set(prev);
                    if (ok) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                className={cn(
                  "min-h-[48px] min-w-[120px] px-4 text-[12px] font-medium uppercase tracking-[0.14em]",
                  ok
                    ? "bg-black text-white"
                    : "border border-black/20 text-black",
                )}
              >
                {ok ? "Verified" : "Mark"}
              </button>
            </li>
          );
        })}
      </ul>

      <PrintSheet
        template="packing"
        printOnly
        vendorName={storeName}
        receiptCode={order.orderNumber}
        customerName={order.customerName}
        notes={order.notes}
        lines={order.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          barcode: it.barcode,
        }))}
      />

      <div className="fixed inset-x-0 bottom-14 z-30 space-y-2 border-t border-black/10 bg-[var(--kc-canvas)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] print:hidden lg:bottom-0">
        <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy || !allVerified}
            onClick={() => void markPacked()}
            className={cn(osUi.btnPrimary, "min-h-12 flex-1")}
          >
            {busy ? "Saving…" : "Mark packed · ready"}
          </button>
          <button
            type="button"
            disabled={!canPrint}
            onClick={() => {
              if (!canPrint) {
                setMessage("Printing requires orders:fulfill");
                return;
              }
              printSheet();
            }}
            className={cn(osUi.btnSecondary, "min-h-12 flex-1 disabled:opacity-40")}
          >
            Print slip
          </button>
        </div>
        {!allVerified ? (
          <p className="text-center text-[12px] text-black/40">
            Verify every line before marking ready
          </p>
        ) : null}
      </div>
    </div>
  );
}
