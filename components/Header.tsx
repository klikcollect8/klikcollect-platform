"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Show } from "@clerk/nextjs";
import ProfileMenu from "./ProfileMenu";
import {
  BagIcon,
  BellIcon,
  CloseIcon,
  MenuIcon,
  SearchIcon,
} from "@/components/NavIcons";
import { useSignInModal } from "./SignInModalProvider";
import { openInstallAppPrompt } from "@/components/InstallAppPrompt";
import { useCart } from "@/lib/hooks/useCart";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useIsClient } from "@/lib/hooks/useIsClient";

const Cart = dynamic(() => import("./Cart"), { ssr: false });
const WishlistSidebar = dynamic(() => import("./WishlistSidebar"), {
  ssr: false,
});
const MobileSearch = dynamic(() => import("./MobileSearch"), { ssr: false });
const NotificationsPanel = dynamic(() => import("./NotificationsPanel"), {
  ssr: false,
});
const OrdersPanel = dynamic(() => import("./OrdersPanel"), { ssr: false });

const NAV_BASE = [
  { name: "Shop", href: "/shop" },
  { name: "Vendors", href: "/brands" },
  { name: "Deals", href: "/todays-deals" },
  { name: "Saved", href: "/saved" },
  { name: "Sell", href: "/sell" },
];

/** Extra destinations after bottom-bar pages in the mobile burger */
const MOBILE_MENU_EXTRA_BASE = [
  { name: "Vendors", href: "/brands" },
  { name: "Deals", href: "/todays-deals" },
  { name: "Saved", href: "/saved" },
  { name: "Sell", href: "/sell" },
  { name: "Categories", href: "/categories" },
] as const;

const iconBtn =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center text-black/80 transition-opacity hover:opacity-50";

const menuLink =
  "border-b border-black/10 py-3.5 text-[clamp(1.5rem,6vw,1.75rem)] font-medium tracking-tight";
const menuBtn = `${menuLink} w-full text-left`;

/** Obscura top bar - aligned logo / nav / actions; notifications panel like search */
export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useIsClient();
  const { showSignInModal } = useSignInModal();
  const { cartItems, updateQuantity, removeFromCart } = useCart();
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const { wishlist, removeFromWishlist } = useWishlist({
    enabled: isWishlistOpen,
  });
  const nav = [...NAV_BASE];
  const mobileMenuExtra = [...MOBILE_MENU_EXTRA_BASE];
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
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
    const onOpenCheckout = () => {
      setIsCartOpen(false);
      router.push("/checkout");
    };
    const onToggleWishlist = () => setIsWishlistOpen(true);
    const onToggleNotifications = () => setIsNotificationsOpen(true);
    const onToggleOrders = () => setIsOrdersOpen(true);
    window.addEventListener("toggleSearch", onToggleSearch);
    window.addEventListener("toggleCart", onToggleCart);
    window.addEventListener("openCheckout", onOpenCheckout);
    window.addEventListener("toggleWishlist", onToggleWishlist);
    window.addEventListener("toggleNotifications", onToggleNotifications);
    window.addEventListener("toggleOrders", onToggleOrders);
    return () => {
      window.removeEventListener("toggleSearch", onToggleSearch);
      window.removeEventListener("toggleCart", onToggleCart);
      window.removeEventListener("openCheckout", onOpenCheckout);
      window.removeEventListener("toggleWishlist", onToggleWishlist);
      window.removeEventListener("toggleNotifications", onToggleNotifications);
      window.removeEventListener("toggleOrders", onToggleOrders);
    };
  }, [router]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMenuOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const openNotifications = () => setIsNotificationsOpen(true);

  return (
    <>
      <header
        className={`transition-colors duration-300 ${
          scrolled ? "bg-[#f7f7f5]/90 backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <div className="mx-auto grid h-16 w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 sm:h-[72px] sm:px-10 lg:px-14 xl:px-20">
          {/* Left - burger + logo, vertically centered */}
          <div className="flex min-w-0 items-center justify-start">
            <button
              type="button"
              className={`${iconBtn} -ml-2 md:hidden`}
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
            >
              <MenuIcon size={22} />
            </button>
            <Link
              href="/"
              className="inline-flex h-11 min-w-0 items-center truncate text-[17px] font-medium uppercase tracking-[0.12em] text-black sm:text-[20px] sm:tracking-[0.14em]"
            >
              KLIKCOLLECT
              <span className="align-super text-[0.55em] tracking-normal">
                ™
              </span>
            </Link>
          </div>

          {/* Center - desktop nav */}
          <nav className="hidden items-center justify-center gap-8 md:flex lg:gap-10">
            {nav.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex h-11 items-center text-[14px] font-medium text-black/75 transition-opacity hover:opacity-45"
              >
                {l.name}
              </Link>
            ))}
          </nav>
          <div className="md:hidden" aria-hidden />

          {/* Right - actions, same h-11 hit targets */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(true)}
              className={iconBtn}
              aria-label="Search"
            >
              <SearchIcon size={22} />
            </button>

            <Show when="signed-in">
              <button
                type="button"
                onClick={openNotifications}
                className={iconBtn}
                aria-label="Notifications"
              >
                <BellIcon size={22} />
              </button>
            </Show>
            <Show when="signed-out">
              <button
                type="button"
                onClick={() =>
                  showSignInModal("Sign in to view notifications", {
                    redirect: "/",
                  })
                }
                className={iconBtn}
                aria-label="Notifications"
              >
                <BellIcon size={22} />
              </button>
            </Show>

            <Show when="signed-out">
              <button
                type="button"
                onClick={() => showSignInModal()}
                className="hidden h-11 items-center px-2 text-[13px] font-medium underline underline-offset-4 decoration-black/30 hover:decoration-black md:inline-flex"
              >
                Sign in
              </button>
            </Show>
            <Show when="signed-in">
              <ProfileMenu showTrigger />
            </Show>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className={`relative ${iconBtn}`}
              aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
            >
              <BagIcon size={22} />
              {cartCount > 0 ? (
                <span className="absolute right-1 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-medium tabular-nums leading-none text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[10050] flex flex-col bg-[#f7f7f5] md:hidden">
              <div className="mx-auto flex h-16 w-full max-w-[1600px] shrink-0 items-center justify-between px-4 sm:px-10">
                <span className="inline-flex h-11 items-center text-[17px] font-medium uppercase tracking-[0.12em] sm:text-[19px]">
                  KLIKCOLLECT
                  <span className="align-super text-[0.55em] tracking-normal">
                    ™
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close"
                  className={iconBtn}
                >
                  <CloseIcon size={20} />
                </button>
              </div>
              <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-10 sm:pt-10">
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-black/40">
                  Menu
                </p>
                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className={menuLink}
                >
                  Home
                </Link>
                <Link
                  href="/shop"
                  onClick={() => setMenuOpen(false)}
                  className={menuLink}
                >
                  Explore
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    window.dispatchEvent(new CustomEvent("toggleCart"));
                  }}
                  className={menuBtn}
                >
                  Cart
                </button>
                <Show when="signed-in">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("toggleOrders"));
                    }}
                    className={menuBtn}
                  >
                    Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("toggleProfile"));
                    }}
                    className={menuBtn}
                  >
                    Profile
                  </button>
                </Show>
                <Show when="signed-out">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      showSignInModal("Sign in to view orders", {
                        redirect: "/",
                      });
                    }}
                    className={menuBtn}
                  >
                    Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      showSignInModal();
                    }}
                    className={menuBtn}
                  >
                    Profile
                  </button>
                </Show>
                {mobileMenuExtra.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className={menuLink}
                  >
                    {l.name}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openInstallAppPrompt();
                  }}
                  className={menuBtn}
                >
                  Get the app
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}

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
      {isMobileSearchOpen ? (
        <MobileSearch
          isOpen
          onClose={() => setIsMobileSearchOpen(false)}
        />
      ) : null}
      {isNotificationsOpen ? (
        <NotificationsPanel
          isOpen
          onClose={() => setIsNotificationsOpen(false)}
        />
      ) : null}
      {isOrdersOpen ? (
        <OrdersPanel isOpen onClose={() => setIsOrdersOpen(false)} />
      ) : null}
    </>
  );
}
