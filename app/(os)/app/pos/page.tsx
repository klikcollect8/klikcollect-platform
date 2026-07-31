"use client";

import { useCallback, useEffect, useState } from "react";
import { Show, SignInButton, useUser } from "@clerk/nextjs";
import { ModuleShell } from "@/components/os/ModuleShell";
import { formatKesMinor } from "@/lib/money";
import { ScanBarcode, Trash2, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Line = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  moneyMinor: number;
  available: number;
  barcode?: string;
};

type Receipt = {
  code: string;
  totalMinor: number;
  currency: string;
  items: Array<{ name: string; quantity: number; moneyMinor: number }>;
  note: string;
};

export default function PosPage() {
  const { user } = useUser();
  const [scan, setScan] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const totalMinor = cart.reduce((s, l) => s + l.moneyMinor * l.quantity, 0);

  const addProduct = useCallback((p: {
    id: string;
    name: string;
    price: number;
    moneyMinor?: number;
    available?: number;
    stock?: number;
    barcode?: string;
  }) => {
    const available = p.available ?? p.stock ?? 0;
    if (available <= 0) {
      setMessage(`${p.name} is out of stock`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        const q = next[idx].quantity + 1;
        if (q > available) {
          setMessage(`Only ${available} available`);
          return prev;
        }
        next[idx] = { ...next[idx], quantity: q };
        return next;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          quantity: 1,
          unitPrice: p.price,
          moneyMinor: p.moneyMinor ?? Math.round(p.price * 100),
          available,
          barcode: p.barcode,
        },
      ];
    });
    setMessage(null);
  }, []);

  async function lookupBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/os/barcode?code=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (!res.ok) {
        setMessage(json?.error?.message || "Barcode not found");
        return;
      }
      addProduct(json.data);
      setScan("");
    } finally {
      setBusy(false);
    }
  }

  async function completeSale() {
    if (!cart.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/os/pos/sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `pos-${user?.id || "anon"}-${Date.now()}`,
        },
        body: JSON.stringify({
          items: cart.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json?.error?.message || "Sale failed");
        return;
      }
      setReceipt(json.receipt);
      setCart([]);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && document.activeElement?.id === "pos-scan") {
        e.preventDefault();
        void lookupBarcode(scan);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <ModuleShell
      title="Point of sale"
      description="Money-free POS - scan, sell, decrement the same inventory. No tender until M3."
    >
      <Show when="signed-out">
        <div className="mb-4 flex items-center justify-between rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white px-4 py-3 text-[13px]">
          <span className="text-[var(--kc-mute)]">Sign in as a vendor operator to sell</span>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-3 py-1.5 text-[12px] font-medium text-white"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </Show>

      {message ? (
        <p className="mb-3 rounded-[var(--kc-radius-sm)] bg-[#fcebea] px-3 py-2 text-[13px] text-[#8e1b0d]">
          {message}
        </p>
      ) : null}

      {receipt ? (
        <div className="mb-4 rounded-[var(--kc-radius)] border border-[#c6ecd4] bg-[#e4f8e9] px-5 py-4">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[#0c5132]">
            Receipt (display-only)
          </p>
          <p className="mt-1 text-[18px] font-semibold text-[#0c5132]">{receipt.code}</p>
          <ul className="mt-3 space-y-1 text-[13px] text-[#0c5132]">
            {receipt.items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {it.name} × {it.quantity}
                </span>
                <span className="tabular-nums">
                  {formatKesMinor(it.moneyMinor * it.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-[#c6ecd4] pt-2 text-[14px] font-semibold text-[#0c5132]">
            <span>Total</span>
            <span>{formatKesMinor(receipt.totalMinor)}</span>
          </p>
          <p className="mt-2 text-[12px] text-[#0c5132]">{receipt.note}</p>
          <button
            type="button"
            onClick={() => setReceipt(null)}
            className="mt-3 text-[12px] font-medium text-[#0c5132] underline"
          >
            New sale
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookupBarcode(scan);
            }}
            className="flex gap-2 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white p-3"
          >
            <div className="flex flex-1 items-center gap-2 rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] px-3">
              <ScanBarcode className="h-4 w-4 text-[var(--kc-faint)]" />
              <input
                id="pos-scan"
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder="Scan or type GTIN / barcode..."
                className="h-10 w-full text-[14px] outline-none"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !scan.trim()}
              className="rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-4 text-[13px] font-medium text-white disabled:opacity-40"
            >
              Add
            </button>
          </form>

          <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-[var(--kc-line-soft)] text-[12px] text-[var(--kc-faint)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">Qty</th>
                  <th className="px-4 py-2.5 font-medium">Line</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--kc-line-soft)]">
                {cart.map((l) => (
                  <tr key={l.productId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--kc-ink)]">{l.name}</p>
                      {l.barcode ? (
                        <p className="text-[11px] text-[var(--kc-faint)]">{l.barcode}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)]">
                        <button
                          type="button"
                          className="px-2 py-1"
                          onClick={() =>
                            setCart((prev) =>
                              prev
                                .map((x) =>
                                  x.productId === l.productId
                                    ? { ...x, quantity: x.quantity - 1 }
                                    : x,
                                )
                                .filter((x) => x.quantity > 0),
                            )
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                        <button
                          type="button"
                          className="px-2 py-1"
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x) =>
                                x.productId === l.productId &&
                                x.quantity < x.available
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x,
                              ),
                            )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatKesMinor(l.moneyMinor * l.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setCart((prev) =>
                            prev.filter((x) => x.productId !== l.productId),
                          )
                        }
                        className="text-[var(--kc-faint)] hover:text-[#8e1b0d]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cart.length ? (
              <p className="px-4 py-10 text-center text-[13px] text-[var(--kc-faint)]">
                Scan a barcode to start a sale
              </p>
            ) : null}
          </div>
        </div>

        <aside className="h-fit rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white p-5">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--kc-faint)]">
            Sale total (display)
          </p>
          <p className="mt-2 text-[28px] font-semibold tabular-nums text-[var(--kc-ink)]">
            {formatKesMinor(totalMinor)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--kc-faint)]">
            No tender · shared inventory with marketplace
          </p>
          <Show when="signed-in">
            <button
              type="button"
              disabled={busy || !cart.length}
              onClick={() => void completeSale()}
              className={cn(
                "mt-5 w-full rounded-[var(--kc-radius-sm)] py-3 text-[14px] font-semibold text-white",
                cart.length
                  ? "bg-[var(--kc-ink)] hover:bg-black"
                  : "bg-[#c6c6c6]",
              )}
            >
              {busy ? "Completing..." : "Complete sale"}
            </button>
          </Show>
        </aside>
      </div>
    </ModuleShell>
  );
}
