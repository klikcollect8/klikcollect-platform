"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsListRow } from "@/components/os/OsListRow";
import { OsEmptyState } from "@/components/os/OsEmptyState";
import { osUi } from "@/components/os/os-ui";

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
};

const PACKABLE = new Set(["pending", "confirmed", "preparing"]);

export default function PackingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/os/orders")
      .then((r) => r.json())
      .then((json) => {
        const data = ((json.data || []) as Order[]).filter((o) =>
          PACKABLE.has(o.status),
        );
        setOrders(data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <ModuleShell
      title="Packing"
      description="Pick an order, verify lines, then mark ready for collection."
      live
      actions={
        <Link href="/app/orders" className={osUi.btnGhost}>
          Orders
        </Link>
      }
    >
      {loading ? (
        <p className="py-16 text-center text-[14px] text-black/40">Loading…</p>
      ) : !orders.length ? (
        <OsEmptyState
          title="Nothing to pack"
          body="New and preparing orders will show up in this queue."
          actionLabel="View orders"
          actionHref="/app/orders"
        />
      ) : (
        <div className="border-t border-black/10">
          {orders.map((o) => (
            <OsListRow
              key={o.id}
              href={`/app/orders/packing/${encodeURIComponent(o.id)}`}
              title={o.orderNumber}
              meta={`${o.customerName} · ${o.items.length} lines · ${o.status}`}
              status={o.status}
            />
          ))}
        </div>
      )}
    </ModuleShell>
  );
}
