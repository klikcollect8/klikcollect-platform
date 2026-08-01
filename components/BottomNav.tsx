"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show } from "@clerk/nextjs";
import { useCart } from "@/lib/hooks/useCart";
import { useSignInModal } from "@/components/SignInModalProvider";
import { useEffect, useState } from "react";

export default function BottomNav() {
  const pathname = usePathname();
  const { showSignInModal } = useSignInModal();
  const { cartItems } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/code-admin") ||
    pathname?.startsWith("/app") ||
    pathname?.startsWith("/account") ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up")
  ) {
    return null;
  }

  if (!mounted) return null;

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const item = (active: boolean) =>
    active ? "text-black" : "text-black/40";

  const tabClass = (active: boolean) =>
    `relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium uppercase tracking-[0.1em] ${item(active)}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[90] border-t border-black/10 bg-[#f7f7f5]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-stretch justify-around px-0.5">
        <Link href="/" className={tabClass(pathname === "/")}>
          Home
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggleSearch"))}
          className={tabClass(false)}
        >
          Search
        </button>
        <Link
          href="/brands"
          className={tabClass(
            Boolean(
              pathname?.startsWith("/brands") || pathname?.startsWith("/vendors"),
            ),
          )}
        >
          Vendors
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggleCart"))}
          className={tabClass(false)}
        >
          Bag
          {cartCount > 0 ? (
            <span className="absolute right-[18%] top-1 text-[10px] tabular-nums text-black">
              {cartCount}
            </span>
          ) : null}
        </button>
        <Show when="signed-in">
          <Link
            href="/account"
            className={tabClass(Boolean(pathname?.startsWith("/account")))}
          >
            Account
          </Link>
        </Show>
        <Show when="signed-out">
          <button
            type="button"
            onClick={() => showSignInModal()}
            className={tabClass(false)}
          >
            Sign in
          </button>
        </Show>
      </div>
    </nav>
  );
}
