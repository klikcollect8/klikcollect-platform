"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Heart, LifeBuoy, Package, User } from "lucide-react";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { Order } from "@/types";
import { formatPrice } from "@/lib/currency";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "ready"]);

export default function AccountOverviewPage() {
  const { user } = useUserAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ordersRes, wishlistRes] = await Promise.all([
          fetch("/api/orders").then((r) => r.json()),
          fetch("/api/user/wishlist").then((r) => (r.ok ? r.json() : [])),
        ]);
        if (cancelled) return;
        const email = user?.email;
        const userOrders = Array.isArray(ordersRes)
          ? ordersRes.filter((o: Order) => !email || o.customerEmail === email)
          : [];
        setOrders(userOrders);
        setWishlistCount(Array.isArray(wishlistRes) ? wishlistRes.length : 0);
      } catch {
        if (!cancelled) {
          setOrders([]);
          setWishlistCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const readyToCollect = orders.filter((o) => o.status === "ready");
  const firstName =
    user?.firstName ||
    user?.fullName?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="space-y-12">
      <div>
        <p className={ui.pageEyebrow}>Overview</p>
        <h1 className={cn("mt-2", ui.pageTitle)}>Welcome back, {firstName}</h1>
        <p className={cn("mt-2", ui.pageDesc)}>
          Orders, wishlist, and settings.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active orders"
          value={loading ? "—" : String(activeOrders.length)}
          href="/account/orders"
          icon={Package}
        />
        <StatTile
          label="Ready to collect"
          value={loading ? "—" : String(readyToCollect.length)}
          href="/account/orders"
          icon={Package}
        />
        <StatTile
          label="Saved"
          value={loading ? "—" : String(wishlistCount)}
          href="/saved"
          icon={Heart}
        />
        <StatTile
          label="Support"
          value="Help"
          href="/account/support"
          icon={LifeBuoy}
        />
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
            Profile
          </h2>
          <div className="mt-5 flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-black/[0.04]">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-12 w-12 object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-black/30" strokeWidth={1.5} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium text-black">
                {user?.fullName || "Account holder"}
              </p>
              <p className="mt-0.5 truncate text-[14px] text-black/40">{user?.email}</p>
              <Link
                href="/account/security"
                className="mt-3 inline-block text-[13px] text-black/45 transition-colors hover:text-black"
              >
                Manage security
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
              Recent orders
            </h2>
            <Link
              href="/account/orders"
              className="text-[13px] text-black/40 transition-colors hover:text-black"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <p className="mt-5 text-[14px] text-black/35">Loading…</p>
          ) : orders.length === 0 ? (
            <div className="mt-5">
              <p className="text-[14px] text-black/40">No orders yet.</p>
              <Link href="/shop" className={cn("mt-4 inline-flex", ui.btnPrimary)}>
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="mt-5 space-y-4">
              {orders.slice(0, 4).map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium text-black">
                      {order.orderNumber}
                    </p>
                    <p className="mt-0.5 text-[13px] text-black/35">
                      {format(new Date(order.createdAt), "MMM d, yyyy")} ·{" "}
                      {formatPrice(order.total)}
                    </p>
                  </div>
                  <Link
                    href={`/order-confirmation/${order.id}`}
                    className="shrink-0 text-[13px] text-black/40 transition-colors hover:text-black"
                  >
                    Details
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  href: string;
  icon: typeof Package;
}) {
  return (
    <Link href={href} className="block transition-opacity hover:opacity-70">
      <Icon className="h-4 w-4 text-black/25" strokeWidth={1.5} />
      <p
        className="mt-4 text-[26px] font-medium tracking-tight tabular-nums text-black"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-black/35">
        {label}
      </p>
    </Link>
  );
}
