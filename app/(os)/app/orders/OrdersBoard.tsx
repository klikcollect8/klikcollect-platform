"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatKesMajor } from "@/lib/money";
import { OsFilterRail } from "@/components/os/OsFilterRail";
import { OsListRow } from "@/components/os/OsListRow";
import { OsEmptyState } from "@/components/os/OsEmptyState";
import { useTableRealtime } from "@/lib/hooks/useTableRealtime";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  collectHub: string;
  status: string;
  total: number;
  createdAt: string;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "New" },
  { id: "confirmed", label: "Confirmed" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "collected", label: "Collected" },
  { id: "cancelled", label: "Cancelled" },
] as const;

export function OrdersBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/os/orders");
    const json = await res.json();
    setOrders(json.data || []);
  }, []);

  useTableRealtime({
    channelName: "os-orders-board",
    table: "orders",
    onEvent: () => void load(),
  });

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(poll);
  }, [load]);

  const filtered = useMemo(() => {
    let list = tab === "all" ? orders : orders.filter((o) => o.status === tab);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(needle) ||
          o.customerName.toLowerCase().includes(needle) ||
          o.customerEmail.toLowerCase().includes(needle) ||
          o.collectHub.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [orders, tab, q]);

  function tabCount(id: (typeof TABS)[number]["id"]) {
    if (id === "all") return orders.length;
    return orders.filter((o) => o.status === id).length;
  }

  return (
    <div className="space-y-5">
      <OsFilterRail
        options={TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: tabCount(t.id),
        }))}
        value={tab}
        onChange={(id) => setTab(id as (typeof TABS)[number]["id"])}
      />

      <label className="block">
        <span className="sr-only">Search orders</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order, customer, hub…"
          className="w-full border-b border-black/15 bg-transparent py-3 text-[15px] text-black outline-none placeholder:text-black/35 focus:border-black/50"
        />
      </label>

      {!filtered.length ? (
        <OsEmptyState
          title="No orders in this view"
          body="New orders will show up here as customers check out."
          actionLabel="Open packing"
          actionHref="/app/orders/packing"
        />
      ) : (
        <div className="border-t border-black/10">
          {filtered.map((o) => (
            <OsListRow
              key={o.id}
              href={`/app/orders/${encodeURIComponent(o.id)}`}
              title={o.orderNumber}
              meta={`${o.customerName} · ${formatKesMajor(o.total)} · ${o.collectHub}`}
              status={o.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
