"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { SignInButton, Show, UserButton } from "@clerk/nextjs";
import Cart from "./Cart";
import WishlistSidebar from "./WishlistSidebar";
import MobileSearch from "./MobileSearch";
import { useCart } from "@/lib/hooks/useCart";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { V1_CATEGORIES } from "@/lib/curation-policy";

const NAV = [
  { name: "Shop", href: "/shop" },
  { name: "Vendors", href: "/brands" },
  { name: "Deals", href: "/todays-deals" },
  { name: "Saved", href: "/saved" },
  { name: "Sell", href: "/sell" },
];

/** Obscura top bar — logo left, links, CTA */
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { cartItems, updateQuantity, removeFromCart } = useCart();
  const { wishlist, removeFromWishlist } = useWishlist();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onToggleSearch = () => setIsMobileSearchOpen(true);
    const onToggleCart = () => setIsCartOpen(true);
    const onToggleWishlist = () => setIsWishlistOpen(true);
    window.addEventListener("toggleSearch", onToggleSearch);
    window.addEventListener("toggleCart", onToggleCart);
    window.addEventListener("toggleWishlist", onToggleWishlist);
    return () => {
      window.removeEventListener("toggleSearch", onToggleSearch);
      window.removeEventListener("toggleCart", onToggleCart);
      window.removeEventListener("toggleWishlist", onToggleWishlist);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-colors duration-300 ${
          scrolled ? "bg-[#f7f7f5]/90 backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] w-full max-w-[1600px] items-center justify-between px-6 sm:px-10 lg:px-14 xl:px-20">
          <Link
            href="/"
            className="text-[16px] font-medium uppercase tracking-[0.14em] text-black"
          >
            KLIKCOLLECT®
          </Link>

          <nav className="hidden items-center gap-10 md:flex">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[14px] font-medium text-black/75 transition-opacity hover:opacity-45"
              >
                {l.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 sm:gap-5">
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              className="text-black/80 transition-opacity hover:opacity-50"
              aria-label="Search"
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="hidden text-[13px] font-medium underline underline-offset-4 decoration-black/30 hover:decoration-black sm:inline"
                >
                  Let&apos;s talk
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/account"
                className="hidden text-[13px] font-medium underline underline-offset-4 decoration-black/30 hover:decoration-black sm:inline"
              >
                Account
              </Link>
              <UserButton />
            </Show>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative text-black/80 transition-opacity hover:opacity-50"
              aria-label={`Bag ${cartCount}`}
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={1.75} />
              {cartCount > 0 ? (
                <span className="absolute -right-2 -top-2 text-[10px] font-medium tabular-nums">
                  {cartCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-[#f7f7f5]">
          <div className="flex h-[64px] items-center justify-between px-5">
            <span className="text-[15px] font-medium uppercase tracking-[0.14em]">
              KLIKCOLLECT®
            </span>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-col gap-2 px-5 pt-10">
            <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-black/40">Menu</p>
            {[{ name: "Home", href: "/" }, ...NAV, { name: "Categories", href: "/categories" }].map(
              (l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="border-b border-black/10 py-4 text-[28px] font-medium tracking-tight"
                >
                  {l.name}
                </Link>
              ),
            )}
            <p className="mt-10 text-[11px] uppercase tracking-[0.2em] text-black/40">
              Shop by department
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {V1_CATEGORIES.slice(0, 8).map((c) => (
                <Link
                  key={c}
                  href={`/shop?category=${encodeURIComponent(c)}`}
                  className="text-[13px] text-black/70 underline-offset-4 hover:underline"
                >
                  {c}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/sell");
              }}
              className="mt-10 text-left text-[13px] font-medium underline underline-offset-4"
            >
              Get in touch →
            </button>
          </div>
        </div>
      ) : null}

      {isCartOpen ? (
        <Cart
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeFromCart}
        />
      ) : null}
      {isWishlistOpen ? (
        <WishlistSidebar
          onClose={() => setIsWishlistOpen(false)}
          items={wishlist}
          onRemoveItem={removeFromWishlist}
        />
      ) : null}
      <MobileSearch isOpen={isMobileSearchOpen} onClose={() => setIsMobileSearchOpen(false)} />
    </>
  );
}
