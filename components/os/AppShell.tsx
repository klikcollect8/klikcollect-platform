"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Bell, Menu, Search, X } from "lucide-react";
import { messages } from "@/messages/en-KE";
import { OS_NAV_GROUPS, OS_PLATFORM_REDIRECTS, osNav } from "./nav";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { osUi } from "@/components/os/os-ui";

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/app") return pathname === "/app";
  // Packing is a sibling under Fulfil - don't light Orders when on packing.
  if (href === "/app/orders") {
    return (
      pathname === "/app/orders" ||
      (pathname.startsWith("/app/orders/") &&
        !pathname.startsWith("/app/orders/packing"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [actorEmail, setActorEmail] = useState<string | null>(null);
  const [vendorLabel, setVendorLabel] = useState<string | null>(null);

  useEffect(() => {
    track("os.page_view", { path: pathname }, "vendor");
  }, [pathname]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMobileOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  /** Bounce platform-only legacy routes out of the vendor panel. */
  useEffect(() => {
    if (!pathname) return;
    const target = OS_PLATFORM_REDIRECTS[pathname];
    if (target) router.replace(target);
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/os/me")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled || !body?.data) return;
        setPermissions(
          Array.isArray(body.data.permissions) ? body.data.permissions : [],
        );
        setActorRole(body.data.role || null);
        setActorEmail(body.data.email || null);
        const vids = body.data.vendorIds as string[] | undefined;
        setVendorLabel(
          vids?.[0] ? `Store · ${vids[0].slice(0, 12)}` : "Your store",
        );
      })
      .catch(() => {
        if (!cancelled) setPermissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/os/orders")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/os/questions")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/os/notifications")
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([ordersRes, questionsRes, notifRes]) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      const orders = ordersRes?.data;
      if (Array.isArray(orders)) {
        next["/app/orders"] = orders.filter((o: { status: string }) =>
          ["pending", "confirmed", "ready"].includes(o.status),
        ).length;
      }
      const questions = questionsRes?.data?.questions;
      if (Array.isArray(questions)) {
        next["/app/questions"] = questions.filter(
          (q: { answers?: unknown[] }) => !(q.answers || []).length,
        ).length;
      }
      const notifs = notifRes?.data;
      if (Array.isArray(notifs)) {
        next["/app/notifications"] = notifs.filter(
          (n: { read_at?: string | null }) => !n.read_at,
        ).length;
      }
      setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const filteredNav = useMemo(() => {
    return osNav.filter((item) => {
      if (!item.permission) return true;
      if (permissions === null) return item.live !== false;
      return permissions.includes(item.permission);
    });
  }, [permissions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const renderSidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col bg-[var(--kc-canvas)]">
      <div className="px-6 pb-6 pt-9">
        <Link href="/app" onClick={onNavigate} className="block">
          <p className={osUi.pageEyebrow}>Store</p>
          <p
            className="mt-2 text-[17px] font-medium tracking-tight text-black"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            klikcollect
          </p>
          <p className="mt-1 text-[12px] text-black/35">
            {vendorLabel || "Your storefront"}
          </p>
        </Link>
      </div>

      <nav className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-8">
        {OS_NAV_GROUPS.map((group) => {
          const items = filteredNav.filter((i) => i.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id} className="mb-7">
              <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-black/30">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  const count = counts[item.href];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-2.5 text-[14px]",
                        active ? osUi.navActive : osUi.navIdle,
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-black" : "text-black/30",
                        )}
                        strokeWidth={1.5}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {typeof count === "number" && count > 0 ? (
                        <span className={osUi.badge}>{count}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-black/10 px-5 py-4">
        <p className="truncate text-[13px] font-medium text-black">
          {actorEmail || "Vendor staff"}
        </p>
        <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.12em] text-black/35">
          {(actorRole || "member").replace(/_/g, " ")}
        </p>
        <div className="mt-3">
          <UserButton />
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-screen text-black", osUi.canvas)}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden lg:block",
          osUi.shellAside,
        )}
      >
        {renderSidebar()}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(300px,90vw)] bg-[var(--kc-canvas)]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 z-10 p-2 text-black/40 hover:text-black"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebar(() => setMobileOpen(false))}
          </aside>
        </div>
      ) : null}

      <div className={osUi.shellAsidePad}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[var(--kc-canvas)]/90 px-6 backdrop-blur-sm sm:px-10 lg:px-12 xl:px-16">
          <button
            type="button"
            className="p-1.5 text-black lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex h-9 max-w-sm flex-1 items-center gap-2.5 text-[13px] text-black/35 transition-colors hover:text-black"
          >
            <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            <span className="flex-1 truncate text-left">Search</span>
            <kbd className="hidden font-mono text-[10px] text-black/30 sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <Link
              href="/app/notifications"
              className="relative p-1.5 text-black/40 transition-colors hover:text-black"
              aria-label={
                counts["/app/notifications"]
                  ? `${counts["/app/notifications"]} unread notifications`
                  : "Notifications"
              }
            >
              <Bell className="h-4 w-4" strokeWidth={1.5} />
              {counts["/app/notifications"] ? (
                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-black" />
              ) : null}
            </Link>
            <Show when="signed-out">
              <SignInButton mode="redirect">
                <button type="button" className={osUi.btnPrimary}>
                  {messages.nav.signIn}
                </button>
              </SignInButton>
              <SignUpButton mode="redirect">
                <button
                  type="button"
                  className={cn(osUi.btnSecondary, "hidden sm:inline-flex")}
                >
                  {messages.nav.signUp}
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </header>

        <main className={osUi.shellMain}>{children}</main>
      </div>

      {cmdOpen ? (
        <CommandPalette
          counts={counts}
          items={filteredNav}
          onClose={() => setCmdOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CommandPalette({
  counts,
  items,
  onClose,
}: {
  counts: Record<string, number>;
  items: typeof osNav;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [query, items]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/30 p-4 pt-[12vh] backdrop-blur-[2px]">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[520px] overflow-hidden border border-black/10 bg-[var(--kc-canvas)] shadow-[-24px_0_80px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-3 border-b border-black/[0.06] px-6 py-5">
          <Search
            className="h-4 w-4 shrink-0 text-black/35"
            strokeWidth={1.5}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="w-full bg-transparent text-[16px] text-black outline-none placeholder:text-black/35"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto px-4 py-4">
          {results.map((item) => {
            const Icon = item.icon;
            const count = counts[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-2 py-3 text-[15px] font-medium text-black transition-opacity hover:opacity-55"
              >
                <Icon className="h-4 w-4 text-black/35" strokeWidth={1.5} />
                <span className="flex-1">{item.label}</span>
                {typeof count === "number" && count > 0 ? (
                  <span className={osUi.badge}>{count}</span>
                ) : null}
              </Link>
            );
          })}
          {!results.length ? (
            <p className="px-3 py-10 text-center text-[14px] text-black/40">
              No matches
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
