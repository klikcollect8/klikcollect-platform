"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
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

export default function PackingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scan, setScan] = useState("");
  const [verified, setVerified] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPrint, setCanPrint] = useState(false);
  const [storeName, setStoreName] = useState("Store");

  async function load() {
    const res = await fetch("/api/os/orders");
    const json = await res.json();
    const data = ((json.data || []) as Order[]).filter((o) =>
      PACKABLE.has(o.status),
    );
    setOrders(data);
    if (selectedId && !data.some((o) => o.id === selectedId)) {
      setSelectedId(data[0]?.id || null);
      setVerified(new Set());
    } else if (!selectedId && data[0]) {
      setSelectedId(data[0].id);
    }
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
    // Initial load only; selectedId updates handled inside load().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(
    () => orders.find((o) => o.id === selectedId) || null,
    [orders, selectedId],
  );

  const lineKeys = useMemo(() => {
    if (!current) return [];
    return current.items.map((it, i) => `${it.productId || it.name}-${i}`);
  }, [current]);

  const allVerified =
    !!current && lineKeys.length > 0 && lineKeys.every((k) => verified.has(k));

  function selectOrder(id: string) {
    setSelectedId(id);
    setVerified(new Set());
    setScan("");
    setMessage(null);
  }

  function verifyBarcode(raw: string) {
    if (!current) return;
    const code = raw.trim().toLowerCase();
    if (!code) return;
    const idx = current.items.findIndex((it) => {
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
    setMessage(`Verified · ${current.items[idx].name}`);
  }

  async function markPacked() {
    if (!current) return;
    setBusy(true);
    setMessage(null);
    try {
      // Walk legal transitions: pending → confirmed → preparing → ready
      const path: Record<string, string[]> = {
        pending: ["confirmed", "preparing", "ready"],
        confirmed: ["preparing", "ready"],
        preparing: ["ready"],
        ready: [],
      };
      const steps = path[current.status] || [];
      for (const status of steps) {
        const res = await fetch("/api/os/orders", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `pack-${current.id}-${status}-${Date.now()}`,
          },
          body: JSON.stringify({
            id: current.id,
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
      setVerified(new Set());
      await load();
      setMessage("Marked ready for collection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleShell
      title="Packing"
      description="Large-touch pick list - verify barcodes, then mark ready."
      live
      actions={
        <Link href="/app/orders" className={osUi.btnGhost}>
          Orders
        </Link>
      }
    >
      <div className="grid gap-6 print:block lg:grid-cols-[280px_1fr]">
        <aside className="divide-y divide-black/[0.06] border-b border-black/10 print:hidden lg:border-b-0 lg:border-r lg:pr-4">
          <p className={cn("pb-3", osUi.sectionLabel)}>
            Open ({orders.length})
          </p>
          {orders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => selectOrder(o.id)}
              className={cn(
                "block w-full py-4 text-left transition-colors",
                selectedId === o.id
                  ? "text-black"
                  : "text-black/45 hover:text-black",
              )}
            >
              <p className="text-[16px] font-medium">{o.orderNumber}</p>
              <p className="mt-1 text-[13px]">{o.customerName}</p>
              <p className="mt-0.5 text-[12px] uppercase tracking-wider opacity-60">
                {o.status}
              </p>
            </button>
          ))}
          {!orders.length ? (
            <p className={cn("py-8 text-[14px]", osUi.muted)}>
              Nothing to pack
            </p>
          ) : null}
        </aside>

        <div className="min-w-0">
          {!current ? (
            <p className={cn("py-16 text-center text-[15px]", osUi.muted)}>
              Select an order to pack
            </p>
          ) : (
            <div className="space-y-6">
              <div className="print:hidden">
                <p className={osUi.pageEyebrow}>{current.status}</p>
                <h2 className={cn("mt-1", osUi.pageTitle)}>
                  {current.orderNumber}
                </h2>
                <p className={cn("mt-1", osUi.pageDesc)}>
                  {current.customerName}
                  {current.notes ? ` · ${current.notes}` : ""}
                </p>
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
                  className={cn(osUi.input, "text-[18px]")}
                  autoComplete="off"
                  autoFocus
                />
                <button type="submit" className={osUi.btnSecondary}>
                  Verify
                </button>
              </form>

              {message ? (
                <p className="text-[14px] font-medium text-black print:hidden">
                  {message}
                </p>
              ) : null}

              <ul className="space-y-3 print:hidden">
                {current.items.map((it, i) => {
                  const key = lineKeys[i];
                  const ok = verified.has(key);
                  return (
                    <li
                      key={key}
                      className={cn(
                        "flex min-h-[72px] items-center justify-between gap-4 border-b border-black/10 py-4",
                        ok ? "opacity-55" : "",
                      )}
                    >
                      <div>
                        <p className="text-[20px] font-medium leading-tight text-black">
                          {it.quantity}× {it.name}
                        </p>
                        {it.barcode ? (
                          <p
                            className={cn(
                              "mt-1 text-[13px] tabular-nums",
                              osUi.muted,
                            )}
                          >
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

              <div className="flex flex-col gap-2 print:hidden sm:flex-row">
                <button
                  type="button"
                  disabled={busy || !allVerified}
                  onClick={() => void markPacked()}
                  className={cn(
                    osUi.btnPrimary,
                    "min-h-[56px] flex-1 text-[13px]",
                  )}
                >
                  {busy ? "Saving…" : "Mark packed · ready"}
                </button>
                <button
                  type="button"
                  disabled={!current || !canPrint}
                  onClick={() => {
                    if (!canPrint) {
                      setMessage("Printing requires orders:fulfill");
                      return;
                    }
                    printSheet();
                  }}
                  className={cn(
                    osUi.btnSecondary,
                    "min-h-[56px] flex-1 text-[13px] disabled:opacity-40",
                  )}
                >
                  Print packing slip
                </button>
              </div>
              {!canPrint ? (
                <p
                  className={cn(
                    "text-center text-[13px] print:hidden",
                    osUi.muted,
                  )}
                >
                  Printing requires orders:fulfill
                </p>
              ) : null}
              {!allVerified ? (
                <p
                  className={cn(
                    "text-center text-[13px] print:hidden",
                    osUi.muted,
                  )}
                >
                  Verify every line before marking ready
                </p>
              ) : null}

              <PrintSheet
                template="packing"
                printOnly
                vendorName={storeName}
                receiptCode={current.orderNumber}
                customerName={current.customerName}
                notes={current.notes}
                lines={current.items.map((it) => ({
                  name: it.name,
                  quantity: it.quantity,
                  barcode: it.barcode,
                }))}
              />
            </div>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
