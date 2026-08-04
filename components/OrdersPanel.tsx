"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { CloseIcon } from "@/components/NavIcons";
import { formatPrice } from "@/lib/currency";
import type { Order } from "@/types";

type OrderRow = Order & {
  paymentStatus?: string;
  paymentReference?: string;
};

type OrdersPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

const subscribe = () => () => {};

export default function OrdersPanel({ isOpen, onClose }: OrdersPanelProps) {
  const { user, isLoaded } = useUser();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (!isOpen) {
      const hide = requestAnimationFrame(() => setIsVisible(false));
      document.body.style.overflow = "";
      return () => cancelAnimationFrame(hide);
    }

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isLoaded) return;

    let cancelled = false;
    const start = requestAnimationFrame(() => {
      if (!cancelled) setLoading(true);
    });

    fetch("/api/orders")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const email =
          user?.primaryEmailAddress?.emailAddress ||
          user?.emailAddresses?.[0]?.emailAddress;
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
      cancelAnimationFrame(start);
    };
  }, [isOpen, isLoaded, user]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Orders"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            Orders
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close orders"
          >
            <span className="hidden sm:inline">Esc</span>
            <CloseIcon size={20} />
          </button>
        </header>

        <div
          className={`mt-6 flex shrink-0 items-end justify-between gap-4 transition-all duration-500 ease-out sm:mt-8 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <div>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight">
              Your orders
            </h2>
            <p className="mt-1.5 text-[13px] text-black/40">
              {loading
                ? "Loading…"
                : orders.length === 0
                  ? "No pickup orders yet"
                  : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
            </p>
          </div>
          <Link
            href="/account/orders"
            onClick={handleClose}
            className="shrink-0 text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
          >
            Full list
          </Link>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(5rem+env(safe-area-inset-bottom))] pt-8 transition-all duration-500 ease-out sm:pt-10 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {loading ? (
            <div className="space-y-0 border-t border-black/[0.08]">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="border-b border-black/[0.06] py-5 sm:py-6"
                >
                  <div className="h-4 w-32 animate-pulse bg-black/[0.06]" />
                  <div className="mt-2 h-3 w-48 animate-pulse bg-black/[0.04]" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="border-t border-black/[0.08] py-16 text-center">
              <p className="text-[16px] font-medium tracking-tight">
                No orders yet
              </p>
              <p className="mt-2 text-[14px] text-black/45">
                When you place a click &amp; collect order, it will show here.
              </p>
              <Link
                href="/shop"
                onClick={handleClose}
                className="mt-8 inline-flex min-h-12 items-center bg-black px-8 text-[12px] font-medium uppercase tracking-[0.14em] text-white hover:opacity-80"
              >
                Browse shop
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.08] border-t border-black/[0.08]">
              {orders.map((order) => (
                <li key={order.id}>
                  <div className="flex items-start justify-between gap-4 py-5 sm:py-6">
                    <Link
                      href={`/order-confirmation/${order.id}`}
                      onClick={handleClose}
                      className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
                    >
                      <p className="truncate text-[15px] font-medium tracking-tight text-black">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1.5 text-[13px] text-black/40">
                        {format(new Date(order.createdAt), "MMM d, yyyy")}
                        <span className="mx-1.5 text-black/20">·</span>
                        {formatPrice(order.total)}
                        <span className="mx-1.5 text-black/20">·</span>
                        {order.status}
                        {order.paymentStatus ? ` · ${order.paymentStatus}` : ""}
                      </p>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                      {order.paymentStatus === "paid" &&
                      order.paymentReference ? (
                        <Link
                          href={`/account/receipts/lookup?ref=${encodeURIComponent(order.paymentReference)}`}
                          onClick={handleClose}
                          className="text-[12px] text-black/45 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
                        >
                          Receipt
                        </Link>
                      ) : null}
                      <Link
                        href={`/order-confirmation/${order.id}`}
                        onClick={handleClose}
                        className="text-[12px] text-black/35 underline underline-offset-[5px] decoration-black/15 hover:text-black hover:decoration-black"
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
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
