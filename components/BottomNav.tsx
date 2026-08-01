"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show } from "@clerk/nextjs";
import { Home, Search, ShoppingBag, Store, User } from "lucide-react";
import { useCart } from "@/lib/hooks/useCart";
import { useSignInModal } from "@/components/SignInModalProvider";
import { showsMobileBottomNav } from "@/lib/mobile-nav";
import { useEffect, useState } from "react";

export default function BottomNav() {
  const pathname = usePathname();
  const { showSignInModal } = useSignInModal();
  const { cartItems } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!showsMobileBottomNav(pathname)) return null;
  if (!mounted) return null;

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const item = (active: boolean) =>
    active ? "text-black" : "text-black/40";

  const tabClass = (active: boolean) =>
    `relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium uppercase tracking-[0.1em] ${item(active)}`;

  const iconProps = { className: "h-[22px] w-[22px]", strokeWidth: 1.75 as const };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[90] border-t border-black/10 bg-[#f7f7f5]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-stretch justify-around px-0.5">
        <Link href="/" className={tabClass(pathname === "/")}>
          <Home {...iconProps} />
          <span>Home</span>
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggleSearch"))}
          className={tabClass(false)}
          aria-label="Search"
        >
          <Search {...iconProps} />
          <span>Search</span>
        </button>
        <Link
          href="/brands"
          className={tabClass(
            Boolean(
              pathname?.startsWith("/brands") || pathname?.startsWith("/vendors"),
            ),
          )}
        >
          <Store {...iconProps} />
          <span>Vendors</span>
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggleCart"))}
          className={tabClass(false)}
          aria-label={cartCount > 0 ? `Bag, ${cartCount} items` : "Bag"}
        >
          <span className="relative">
            <ShoppingBag {...iconProps} />
            {cartCount > 0 ? (
              <span className="absolute -right-2 -top-1.5 min-w-[14px] text-center text-[10px] tabular-nums leading-none text-black">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </span>
          <span>Bag</span>
        </button>
        <Show when="signed-in">
          <Link
            href="/account"
            className={tabClass(Boolean(pathname?.startsWith("/account")))}
          >
            <User {...iconProps} />
            <span>Account</span>
          </Link>
        </Show>
        <Show when="signed-out">
          <button
            type="button"
            onClick={() => showSignInModal()}
            className={tabClass(false)}
            aria-label="Sign in"
          >
            <User {...iconProps} />
            <span>Sign in</span>
          </button>
        </Show>
      </div>
    </nav>
  );
}
