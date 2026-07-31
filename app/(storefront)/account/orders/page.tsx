"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Package } from "lucide-react";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { Order } from "@/types";
import { formatPrice } from "@/lib/currency";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

function statusClasses(status: Order["status"]) {
  switch (status) {
    case "pending":
      return "bg-[#fff1e3] text-[#5e4200]";
    case "confirmed":
      return "bg-[var(--kc-canvas)] text-[var(--kc-ink)]";
    case "ready":
      return "bg-[#e4f8e9] text-[#0c5132]";
    case "collected":
      return "bg-[var(--kc-canvas)] text-[var(--kc-mute)]";
    case "cancelled":
      return "bg-[#fcebea] text-[#8e1b0d]";
    default:
      return "bg-[var(--kc-canvas)] text-[var(--kc-mute)]";
  }
}

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
    <div className="space-y-10">
      <div>
        <p className={ui.pageEyebrow}>Account</p>
        <h1 className={`mt-3 ${ui.pageTitle}`}>Orders</h1>
        <p className={cn("mt-2", ui.pageDesc)}>
          Track pickup orders linked to {user?.email || "your email"}.
        </p>
      </div>

      <section className={ui.panel}>
        {loading ? (
          <p className="p-6 text-[13px] text-[var(--kc-faint)]">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-[var(--kc-line)]" strokeWidth={1.5} />
            <p className="mt-3 text-[13px] text-[var(--kc-mute)]">You have not placed any orders yet.</p>
            <Link href="/" className={cn("mt-4 inline-block", ui.btnPrimary)}>
              Browse products
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--kc-line-soft)]">
            {orders.map((order) => (
              <li key={order.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--kc-ink)]">{order.orderNumber}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--kc-faint)]">
                      Placed {format(new Date(order.createdAt), "MMMM d, yyyy")}
                    </p>
                    <p className="text-[12px] text-[var(--kc-faint)]">
                      Pickup {format(new Date(order.pickupDate), "MMM d")} at {order.pickupTime}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                      statusClasses(order.status),
                    )}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[var(--kc-line-soft)] pt-3">
                  <span className="text-[15px] font-semibold text-[var(--kc-ink)]">
                    {formatPrice(order.total)}
                  </span>
                  <Link
                    href={`/order-confirmation/${order.id}`}
                    className="text-[13px] font-medium text-[var(--kc-ink)] hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
