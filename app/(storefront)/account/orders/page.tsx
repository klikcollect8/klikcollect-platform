"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { Order } from "@/types";
import { formatPrice } from "@/lib/currency";

type OrderRow = Order & {
  paymentStatus?: string;
  paymentReference?: string;
  receiptPublicId?: string | null;
};

export default function AccountOrdersPage() {
  const { user } = useUserAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/orders")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const email = user?.email;
        const list: OrderRow[] = Array.isArray(body)
          ? body
          : Array.isArray(body?.data)
            ? body.data
            : Array.isArray(body?.orders)
              ? body.orders
              : [];
        setOrders(list.filter((o) => !email || o.customerEmail === email));
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
              <div className="flex h-auto min-h-14 items-center justify-between gap-4 border-b border-black/[0.08] py-3">
                <Link
                  href={`/order-confirmation/${order.id}`}
                  className="min-w-0 flex-1 text-left transition-colors hover:text-black"
                >
                  <p className="truncate text-[15px] font-medium text-black">
                    {order.orderNumber}
                  </p>
                  <p className="mt-0.5 text-[13px] text-black/35">
                    {format(new Date(order.createdAt), "MMM d, yyyy")} ·{" "}
                    {formatPrice(order.total)} · {order.status}
                    {order.paymentStatus ? ` · ${order.paymentStatus}` : ""}
                  </p>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {order.paymentStatus === "paid" && order.paymentReference ? (
                    <Link
                      href={`/account/receipts/lookup?ref=${encodeURIComponent(order.paymentReference)}`}
                      className="text-[11px] uppercase tracking-[0.14em] text-black/50 underline"
                    >
                      Receipt
                    </Link>
                  ) : null}
                  <Link
                    href={`/order-confirmation/${order.id}`}
                    className="text-[11px] uppercase tracking-[0.14em] text-black/25"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
