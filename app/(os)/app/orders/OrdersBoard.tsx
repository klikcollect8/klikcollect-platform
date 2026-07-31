"use client";

import { useEffect, useMemo, useState } from "react";
import { Show, SignInButton } from "@clerk/nextjs";
import { formatKesMajor } from "@/lib/money";
import { StatusBadge } from "@/components/os/StatusBadge";
import { cn } from "@/lib/utils";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  collectHub: string;
  status: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  total: number;
  notes?: string;
  createdAt: string;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Unfulfilled" },
  { id: "confirmed", label: "Accepted" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "collected", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const NEXT: Record<string, string | null> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "collected",
  collected: null,
  cancelled: null,
};

export function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/os/orders");
    const json = await res.json();
    setOrders(json.data || []);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    if (tab === "pending") {
      return orders.filter(
        (o) =>
          o.status === "pending" ||
          o.status === "confirmed" ||
          o.status === "preparing",
      );
    }
    return orders.filter((o) => o.status === tab);
  }, [orders, tab]);

  const current = orders.find((o) => o.id === selected) || null;

  async function advance(id: string, status: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/os/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `os-order-${id}-${status}-${Date.now()}`,
        },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (res.ok) await load();
      else alert(json?.error?.message || "Transition rejected");
    } finally {
      setBusy(false);
    }
  }

  function tabCount(id: (typeof TABS)[number]["id"]) {
    if (id === "all") return orders.length;
    if (id === "pending") {
      return orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
    }
    return orders.filter((o) => o.status === id).length;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white">
        {/* Shopify filter tabs */}
        <div className="flex flex-wrap gap-1 border-b border-[var(--kc-line-soft)] px-3 py-2.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-[var(--kc-radius-sm)] px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                tab === t.id
                  ? "bg-[var(--kc-canvas)] text-[var(--kc-ink)]"
                  : "text-[var(--kc-mute)] hover:bg-[var(--kc-canvas)]/60",
              )}
            >
              {t.label}
              <span className="ml-1 text-[var(--kc-faint)]">{tabCount(t.id)}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-[var(--kc-line-soft)] text-[12px] text-[var(--kc-faint)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Collect</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--kc-line-soft)]">
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selected === o.id ? "bg-[var(--kc-canvas)]" : "hover:bg-[var(--kc-canvas)]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--kc-ink)]">{o.orderNumber}</div>
                    <div className="text-[12px] text-[var(--kc-faint)]">
                      {new Date(o.createdAt).toLocaleString("en-KE")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--kc-ink)]">{o.customerName}</div>
                    <div className="text-[12px] text-[var(--kc-faint)]">{o.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--kc-mute)]">{o.collectHub}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--kc-ink)]">
                    {formatKesMajor(o.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length ? (
          <p className="px-4 py-12 text-center text-[13px] text-[var(--kc-faint)]">
            No orders in this view
          </p>
        ) : null}
      </div>

      {/* Detail — Linear-style quiet panel */}
      <aside className="h-fit rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-white p-4 lg:sticky lg:top-16">
        {!current ? (
          <p className="py-10 text-center text-[13px] text-[var(--kc-faint)]">
            Select an order
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--kc-ink)]">
                  {current.orderNumber}
                </h3>
                <p className="mt-0.5 text-[12px] text-[var(--kc-faint)]">
                  {new Date(current.createdAt).toLocaleString("en-KE")}
                </p>
              </div>
              <StatusBadge status={current.status} />
            </div>

            <div className="space-y-0.5 text-[13px]">
              <div className="font-medium text-[var(--kc-ink)]">{current.customerName}</div>
              <div className="text-[var(--kc-mute)]">{current.customerEmail}</div>
              <div className="text-[var(--kc-mute)]">{current.customerPhone}</div>
              <div className="pt-1 text-[var(--kc-ink)]">
                Collect · <span className="font-medium">{current.collectHub}</span>
              </div>
            </div>

            <div className="border-t border-[var(--kc-line-soft)] pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--kc-faint)]">
                Items
              </p>
              <ul className="space-y-2 text-[13px]">
                {current.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-[var(--kc-ink)]">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="tabular-nums text-[var(--kc-mute)]">
                      {formatKesMajor(it.unitPrice * it.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-[var(--kc-line-soft)] pt-3 text-[13px] font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatKesMajor(current.total)}</span>
              </div>
            </div>

            {current.notes ? (
              <p className="rounded-[var(--kc-radius-sm)] bg-[#fff1e3] px-3 py-2 text-[12px] text-[#5e4200]">
                {current.notes}
              </p>
            ) : null}

            <Show when="signed-out">
              <SignInButton mode="redirect">
                <button
                  type="button"
                  className="w-full rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] px-3 py-2 text-[13px] font-medium hover:bg-[var(--kc-canvas)]"
                >
                  Sign in to update
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <div className="flex flex-wrap gap-2">
                {NEXT[current.status] ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void advance(current.id, NEXT[current.status]!)}
                    className="flex-1 rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-3 py-2 text-[13px] font-medium text-white hover:bg-black disabled:opacity-50"
                  >
                    Mark {NEXT[current.status]}
                  </button>
                ) : null}
                {current.status !== "cancelled" && current.status !== "collected" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void advance(current.id, "cancelled")}
                    className="rounded-[var(--kc-radius-sm)] border border-[var(--kc-line)] px-3 py-2 text-[13px] font-medium hover:bg-[var(--kc-canvas)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </Show>
          </div>
        )}
      </aside>
    </div>
  );
}
