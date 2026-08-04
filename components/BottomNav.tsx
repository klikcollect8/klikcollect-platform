"use client";

import { useEffect, useRef } from "react";
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
  const navRef = useRef<HTMLElement>(null);

  const visible = showsMobileBottomNav(pathname);

  // Keep the bar glued to the visual viewport on iOS Safari (URL bar show/hide).
  useEffect(() => {
    if (!visible || !mounted) return;
    const nav = navRef.current;
    if (!nav) return;

    const vv = window.visualViewport;
    const pin = () => {
      if (!vv) {
        nav.style.bottom = "0px";
        return;
      }
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      nav.style.bottom = `${inset}px`;
    };

    pin();
    vv?.addEventListener("resize", pin);
    vv?.addEventListener("scroll", pin);
    window.addEventListener("orientationchange", pin);
    return () => {
      vv?.removeEventListener("resize", pin);
      vv?.removeEventListener("scroll", pin);
      window.removeEventListener("orientationchange", pin);
      nav.style.bottom = "";
    };
  }, [visible, mounted]);

  if (!visible) return null;
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
      ref={navRef}
      className="kc-bottom-nav lg:hidden"
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
