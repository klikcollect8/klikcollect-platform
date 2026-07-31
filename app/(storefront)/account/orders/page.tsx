"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { Order } from "@/types";
import { formatPrice } from "@/lib/currency";

export default function AccountOrdersPage() {
  const { user } = useUserAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const email = user?.email;
        setOrders(
          Array.isArray(data)
            ? data.filter((o: Order) => !email || o.customerEmail === email)
            : [],
        );
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  return (
    <div className="space-y-10 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Orders
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          Track pickup orders linked to {user?.email || "your email"}.
        </p>
      </div>

      {loading ? (
        <p className="text-[14px] text-black/35">Loading…</p>
      ) : orders.length === 0 ? (
        <div>
          <p className="text-[14px] text-black/40">No orders yet.</p>
          <Link
            href="/shop"
            className="mt-6 flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/order-confirmation/${order.id}`}
                className="flex h-14 items-center justify-between gap-4 border-b border-black/[0.08] transition-colors hover:text-black"
              >
                <div className="min-w-0 text-left">
                  <p className="truncate text-[15px] font-medium text-black">
                    {order.orderNumber}
                  </p>
                  <p className="mt-0.5 text-[13px] text-black/35">
                    {format(new Date(order.createdAt), "MMM d, yyyy")} ·{" "}
                    {formatPrice(order.total)} · {order.status}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-black/25">
                  Open
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
