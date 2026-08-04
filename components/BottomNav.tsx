"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show } from "@clerk/nextjs";
import {
  AccountIcon,
  BagIcon,
  ExploreIcon,
  HomeIcon,
  OrdersIcon,
} from "@/components/NavIcons";
import { useCart } from "@/lib/hooks/useCart";
import { useSignInModal } from "@/components/SignInModalProvider";
import { showsMobileBottomNav } from "@/lib/mobile-nav";
import { useIsClient } from "@/lib/hooks/useIsClient";

export default function BottomNav() {
  const pathname = usePathname();
  const { showSignInModal } = useSignInModal();
  const { cartItems } = useCart();
  const mounted = useIsClient();

  if (!showsMobileBottomNav(pathname)) return null;
  if (!mounted) return null;

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const homeActive = pathname === "/";
  const exploreActive = Boolean(pathname?.startsWith("/shop"));
  const ordersActive = Boolean(
    pathname?.startsWith("/account/orders") || pathname === "/orders",
  );

  const tabClass = (active: boolean) =>
    `relative flex h-12 flex-1 items-center justify-center transition-colors ${
      active ? "text-black" : "text-black/35"
    }`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[90] border-t border-black/10 bg-[#f7f7f5]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Primary"
    >
      <div className="flex h-12 items-stretch justify-around px-1">
        <Link
          href="/"
          className={tabClass(homeActive)}
          aria-label="Home"
          aria-current={homeActive ? "page" : undefined}
        >
          <HomeIcon active={homeActive} />
        </Link>

        <Link
          href="/shop"
          className={tabClass(exploreActive)}
          aria-label="Explore"
          aria-current={exploreActive ? "page" : undefined}
        >
          <ExploreIcon active={exploreActive} />
        </Link>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggleCart"))}
          className={tabClass(false)}
          aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
        >
          <BagIcon />
        </button>

        <Show when="signed-in">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("toggleOrders"))
            }
            className={tabClass(ordersActive)}
            aria-label="Orders"
          >
            <OrdersIcon active={ordersActive} />
          </button>
        </Show>
        <Show when="signed-out">
          <button
            type="button"
            onClick={() =>
              showSignInModal("Sign in to view orders", {
                redirect: "/",
              })
            }
            className={tabClass(false)}
            aria-label="Orders"
          >
            <OrdersIcon />
          </button>
        </Show>

        <Show when="signed-in">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("toggleProfile"))
            }
            className={tabClass(false)}
            aria-label="Profile"
          >
            <AccountIcon />
          </button>
        </Show>
        <Show when="signed-out">
          <button
            type="button"
            onClick={() => showSignInModal()}
            className={tabClass(false)}
            aria-label="Sign in"
          >
            <AccountIcon />
          </button>
        </Show>
      </div>
    </nav>
  );
}
