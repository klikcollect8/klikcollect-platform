"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Home,
  Menu,
  Package,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileAdminNavItem = {
  href: string;
  label: string;
  groupLabel: string;
  icon: LucideIcon;
};

type Props = {
  pathname: string | null;
  items: MobileAdminNavItem[];
  onOpenControlPanel: () => void;
  onOpenInstallPrompt: () => void;
};

const PRIMARY_TABS = [
  { href: "/admin", label: "Home", icon: Home },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
] as const;

function matchesPath(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin" || href === "/admin/products") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminMobileNavigation({
  pathname,
  items,
  onOpenControlPanel,
  onOpenInstallPrompt,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const availableHrefs = useMemo(
    () => new Set(items.map((item) => item.href)),
    [items],
  );
  const tabs = PRIMARY_TABS.filter(({ href }) => availableHrefs.has(href));
  const moreActive =
    !tabs.some(({ href }) => matchesPath(pathname, href)) &&
    pathname !== "/admin";

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        aria-label="Admin navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-[var(--kc-canvas)]/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md lg:hidden"
      >
        <div className="grid min-h-[var(--admin-bottom-nav-h,72px)] grid-flow-col auto-cols-fr">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = matchesPath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium",
                  active ? "text-black" : "text-black/45",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.6} />
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium",
              moreActive || moreOpen ? "text-black" : "text-black/45",
            )}
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={moreOpen ? 2 : 1.6} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <AdminMoreMenu
          items={items.filter(
            (item) => !PRIMARY_TABS.some((tab) => tab.href === item.href),
          )}
          onClose={() => setMoreOpen(false)}
          onOpenControlPanel={() => {
            setMoreOpen(false);
            onOpenControlPanel();
          }}
          onOpenInstallPrompt={() => {
            setMoreOpen(false);
            onOpenInstallPrompt();
          }}
        />
      ) : null}
    </>
  );
}

function AdminMoreMenu({
  items,
  onClose,
  onOpenControlPanel,
  onOpenInstallPrompt,
}: {
  items: MobileAdminNavItem[];
  onClose: () => void;
  onOpenControlPanel: () => void;
  onOpenInstallPrompt: () => void;
}) {
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? items.filter(
          (item) =>
            item.label.toLowerCase().includes(normalizedQuery) ||
            item.groupLabel.toLowerCase().includes(normalizedQuery),
        )
      : items;
    return Array.from(
      filtered.reduce((map, item) => {
        const group = map.get(item.groupLabel) ?? [];
        group.push(item);
        map.set(item.groupLabel, group);
        return map;
      }, new Map<string, MobileAdminNavItem[]>()),
    );
  }, [items, query]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] lg:hidden">
      <button
        type="button"
        aria-label="Close more menu"
        className="absolute inset-0 hidden bg-black/30 sm:block"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-more-title"
        className="absolute inset-0 flex flex-col bg-[var(--kc-canvas)] sm:inset-x-0 sm:bottom-0 sm:top-auto sm:max-h-[88dvh] sm:rounded-t-2xl"
      >
        <header className="flex min-h-[var(--admin-header-h,56px)] shrink-0 items-center gap-2 border-b border-black/10 px-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 min-w-11 items-center justify-center text-black/60"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 id="admin-more-title" className="text-[17px] font-medium">
            More
          </h2>
        </header>

        <div className="shrink-0 border-b border-black/10 px-4 py-3 sm:px-6">
          <label className="flex min-h-11 items-center gap-3 border-b border-black/20">
            <Search className="h-4 w-4 shrink-0 text-black/35" />
            <span className="sr-only">Search admin modules</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules"
              className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-black/35"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:px-6">
          {groups.length ? (
            <div className="space-y-7">
              {groups.map(([groupLabel, groupItems]) => (
                <section
                  key={groupLabel}
                  aria-labelledby={`more-${groupLabel.toLowerCase().replaceAll(" ", "-")}`}
                >
                  <h3
                    id={`more-${groupLabel.toLowerCase().replaceAll(" ", "-")}`}
                    className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-black/35"
                  >
                    {groupLabel}
                  </h3>
                  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                    {groupItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className="flex min-h-11 items-center gap-3 px-2 py-2.5 text-[14px] font-medium text-black/65 hover:bg-black/[0.035] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-black/35" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}

              {!query ? (
                <section aria-labelledby="more-secondary">
                  <h3
                    id="more-secondary"
                    className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.18em] text-black/35"
                  >
                    Secondary
                  </h3>
                  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                    <SecondaryButton
                      icon={SlidersHorizontal}
                      label="Control panel"
                      onClick={onOpenControlPanel}
                    />
                    <SecondaryButton
                      icon={Smartphone}
                      label="Get the app"
                      onClick={onOpenInstallPrompt}
                    />
                    <Link
                      href="/app"
                      onClick={onClose}
                      className="flex min-h-11 items-center gap-3 px-2 py-2.5 text-[14px] font-medium text-black/65 hover:bg-black/[0.035] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    >
                      <Store className="h-4 w-4 text-black/35" />
                      Vendor workspace
                    </Link>
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="py-16 text-center text-[14px] text-black/40">
              No modules match “{query}”
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SecondaryButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center gap-3 px-2 py-2.5 text-left text-[14px] font-medium text-black/65 hover:bg-black/[0.035] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      <Icon className="h-4 w-4 text-black/35" />
      {label}
    </button>
  );
}
