"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Order } from "@/types";
import { format } from "date-fns";
import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

export default function OrderConfirmation() {
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetch(`/api/orders/${params.id}`)
        .then((res) => res.json())
        .then((data) => {
          setOrder(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">Loading</p>
      </div>
    );
  }

  if (!order) {
    return (
      <StorePage narrow>
        <StoreHeading title="Order not found" description="We couldn’t find that order." />
        <Link
          href="/account/orders"
          className="inline-flex bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
        >
          View orders
        </Link>
      </StorePage>
    );
  }

  const paymentStatus = order.paymentStatus || "pending";

  return (
    <StorePage narrow>
      <div className="border-b border-black/[0.06] pb-12 text-center">
        <CheckCircle className="mx-auto mb-6 h-10 w-10 text-black" strokeWidth={1.25} />
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.24em] text-black/40">
          Confirmed
        </p>
        <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-tight">
          Order placed
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[16px] text-black/50">
          We’ll have it ready for pickup. Check your email for details.
        </p>
        <p className="mt-6 text-[12px] uppercase tracking-[0.16em] text-black/40">
          {paymentStatus === "paid"
            ? "Payment confirmed"
            : paymentStatus === "failed"
              ? "Payment failed"
              : "Payment pending · live tender at M3"}
        </p>
      </div>

      <div className="mt-12 space-y-10 border border-black/10 p-8 sm:p-10">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-black/40">Order number</p>
          <p className="mt-2 text-[22px] font-medium tracking-tight">{order.orderNumber}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-[12px] uppercase tracking-[0.16em] text-black/40">Pickup date</p>
            <p className="mt-2 text-[15px] font-medium">
              {format(new Date(order.pickupDate), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-[0.16em] text-black/40">Pickup time</p>
            <p className="mt-2 text-[15px] font-medium">{order.pickupTime}</p>
          </div>
        </div>

        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-black/40">Customer</p>
          <p className="mt-2 text-[15px] font-medium">{order.customerName}</p>
          <p className="mt-1 text-[14px] text-black/50">{order.customerEmail}</p>
          <p className="text-[14px] text-black/50">{order.customerPhone}</p>
        </div>

        <div className="border-t border-black/[0.06] pt-8">
          <p className="mb-4 text-[12px] uppercase tracking-[0.16em] text-black/40">Items</p>
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between gap-4 text-[14px]">
                <span className="text-black/70">
                  {item.product.name} × {item.quantity}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatPrice(
                    (item.offerPrice ?? item.product.price ?? 0) * item.quantity,
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between border-t border-black/[0.06] pt-6 text-[16px] font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link
          href="/shop"
          className="inline-flex bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
        >
          Continue shopping
        </Link>
        <Link
          href="/account/orders"
          className="inline-flex border border-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-black hover:text-white"
        >
          View orders
        </Link>
      </div>
    </StorePage>
  );
}
