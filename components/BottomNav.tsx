"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show } from "@clerk/nextjs";
import { useCart } from "@/lib/hooks/useCart";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useEffect, useState } from "react";

export default function BottomNav() {
  const pathname = usePathname();
  const { cartItems } = useCart();
  const { wishlist } = useWishlist();
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[90] border-t border-black/10 bg-[#f7f7f5]/92 pb-safe backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-around px-1">
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${item(pathname === "/")}`}
        >
          Home
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggleSearch"))}
          className="flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-black/40"
        >
          Search
        </button>
        <Link
          href="/saved"
          className={`relative flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${item(pathname === "/saved")}`}
        >
          Saved
          {wishlist.length > 0 ? (
            <span className="absolute right-[30%] top-0 text-[9px] tabular-nums text-black">
              {wishlist.length}
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("toggleCart"))}
          className="relative flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-black/40"
        >
          Bag
          {cartCount > 0 ? (
            <span className="absolute right-[28%] top-0 text-[9px] tabular-nums text-black">
              {cartCount}
            </span>
          ) : null}
        </button>
        <Show when="signed-in">
          <Link
            href="/account"
            className={`flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${item(pathname?.startsWith("/account") || false)}`}
          >
            Account
          </Link>
        </Show>
        <Show when="signed-out">
          <Link
            href="/sign-in"
            className="flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-black/40"
          >
            Sign in
          </Link>
        </Show>
      </div>
    </nav>
  );
}
