"use client";

import { createPortal } from "react-dom";
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

/**
 * Fixed mobile dock — always pinned to the visual viewport bottom.
 * Hides while the soft keyboard is open (Capacitor / iOS).
 */
const dockStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  top: "auto",
  zIndex: 9999,
  width: "100%",
  maxWidth: "100vw",
  margin: 0,
  transform: "translate3d(0,0,0)",
  WebkitTransform: "translate3d(0,0,0)",
  borderTop: "1px solid rgba(10, 10, 10, 0.1)",
  background: "#f7f7f5",
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  // Stay above iOS rubber-band / Capacitor WebView quirks
  paddingLeft: "env(safe-area-inset-left, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
};

export default function BottomNav() {
  const pathname = usePathname();
  const { showSignInModal } = useSignInModal();
  const { cartItems } = useCart();
  const mounted = useIsClient();

  if (!mounted) return null;
  if (!showsMobileBottomNav(pathname)) return null;

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

  return createPortal(
    <nav
      className="kc-bottom-nav lg:hidden"
      aria-label="Primary"
      style={dockStyle}
      data-kc-bottom-nav=""
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
          {cartCount > 0 ? (
            <span className="absolute right-[18%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-medium tabular-nums leading-none text-white">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          ) : null}
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
    </nav>,
    document.body,
  );
}
