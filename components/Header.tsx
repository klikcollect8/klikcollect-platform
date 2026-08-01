"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { Show } from "@clerk/nextjs";
import Cart from "./Cart";
import WishlistSidebar from "./WishlistSidebar";
import MobileSearch from "./MobileSearch";
import ProfileMenu from "./ProfileMenu";
import { useSignInModal } from "./SignInModalProvider";
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
  const { showSignInModal } = useSignInModal();
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
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:h-[72px] sm:px-10 lg:px-14 xl:px-20">
          <Link
            href="/"
            className="min-h-11 min-w-0 truncate pr-2 text-[17px] font-medium uppercase tracking-[0.12em] text-black sm:text-[20px] sm:tracking-[0.14em]"
          >
            KLIKCOLLECT
            <span className="align-super text-[0.55em] tracking-normal">™</span>
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

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center text-black/80 transition-opacity hover:opacity-50"
              aria-label="Search"
            >
              <Search className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <Show when="signed-out">
              <button
                type="button"
                onClick={() => showSignInModal()}
                className="hidden min-h-11 items-center px-2 text-[13px] font-medium underline underline-offset-4 decoration-black/30 hover:decoration-black sm:inline-flex"
              >
                Sign in
              </button>
            </Show>
            <Show when="signed-in">
              <ProfileMenu />
            </Show>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex h-11 w-11 items-center justify-center text-black/80 transition-opacity hover:opacity-50"
              aria-label={`Bag ${cartCount}`}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
              {cartCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 text-[10px] font-medium tabular-nums">
                  {cartCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#f7f7f5]">
          <div className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-5">
            <span className="text-[17px] font-medium uppercase tracking-[0.12em] sm:text-[19px]">
              KLIKCOLLECT
              <span className="align-super text-[0.55em] tracking-normal">™</span>
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-5 sm:pt-10">
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-black/40">Menu</p>
            {[{ name: "Home", href: "/" }, ...NAV, { name: "Categories", href: "/categories" }].map(
              (l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="border-b border-black/10 py-3.5 text-[clamp(1.5rem,6vw,1.75rem)] font-medium tracking-tight"
                >
                  {l.name}
                </Link>
              ),
            )}
            <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-black/40">
              Shop by department
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
              {V1_CATEGORIES.slice(0, 8).map((c) => (
                <Link
                  key={c}
                  href={`/shop?category=${encodeURIComponent(c)}`}
                  className="min-h-10 inline-flex items-center text-[13px] text-black/70 underline-offset-4 hover:underline"
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
              className="mt-8 min-h-11 text-left text-[13px] font-medium underline underline-offset-4"
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
