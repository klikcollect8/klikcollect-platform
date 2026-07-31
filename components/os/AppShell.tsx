"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Menu, Search, X } from "lucide-react";
import { messages } from "@/messages/en-KE";
import { osNav } from "./nav";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import { ui } from "@/components/system/tokens";

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const groups = [
  { id: "operate" as const, label: "Operate" },
  { id: "grow" as const, label: "Grow" },
  { id: "system" as const, label: "System" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    track("os.page_view", { path: pathname }, "vendor");
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/os/orders").then((r) => r.json()).catch(() => null),
      fetch("/api/curation").then((r) => r.json()).catch(() => null),
    ]).then(([ordersRes, curationRes]) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      const orders = ordersRes?.data;
      if (Array.isArray(orders)) {
        next["/app/orders"] = orders.filter((o: { status: string }) =>
          ["pending", "confirmed", "ready"].includes(o.status),
        ).length;
      }
      const apps = curationRes?.data?.applications;
      if (Array.isArray(apps)) {
        next["/app/curation"] = apps.filter(
          (a: { status: string }) => a.status === "pending",
        ).length;
      }
      setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-[#f7f7f5]">
      <div className="px-7 pb-6 pt-9">
        <Link href="/app" onClick={onNavigate} className="block">
          <p className={ui.pageEyebrow}>Vendor OS</p>
          <p
            className="mt-2 text-[17px] font-medium tracking-tight text-black"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            klikcollect
          </p>
          <p className="mt-1 text-[12px] text-black/35">Nairobi</p>
        </Link>
      </div>

      <nav className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-8">
        {groups.map((group) => {
          const visible = osNav.filter((i) => i.group === group.id);
          if (!visible.length) return null;
          return (
            <div key={group.id} className="mb-7">
              <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-black/30">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => {
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
                        active ? ui.navActive : ui.navIdle,
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
                        <span className="text-[11px] tabular-nums text-black/40">
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-black">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden lg:block", ui.shellAside)}>
        <Sidebar />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(320px,90vw)] bg-[#f7f7f5]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 z-10 p-2 text-black/40 hover:text-black"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className={ui.shellAsidePad}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#f7f7f5]/90 px-8 backdrop-blur-sm sm:px-12 lg:px-16 xl:px-20">
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
            <span className="hidden text-[11px] uppercase tracking-[0.14em] text-black/30 md:block">
              {messages.market}
            </span>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className={ui.btnPrimary}>
                  {messages.nav.signIn}
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className={cn(ui.btnSecondary, "hidden sm:inline-flex")}
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

        <main className={ui.shellMain}>{children}</main>
      </div>

      {cmdOpen ? (
        <CommandPalette counts={counts} onClose={() => setCmdOpen(false)} />
      ) : null}
    </div>
  );
}

function CommandPalette({
  counts,
  onClose,
}: {
  counts: Record<string, number>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return osNav;
    return osNav.filter((i) => i.label.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 p-4 pt-[12vh]">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-[560px] overflow-hidden border border-black/10 bg-[#f7f7f5] shadow-[-24px_0_80px_rgba(0,0,0,0.12)]">
        <div className="flex items-center gap-3 border-b border-black/[0.06] px-6 py-5">
          <Search className="h-4 w-4 shrink-0 text-black/35" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="w-full bg-transparent text-[16px] text-black outline-none placeholder:text-black/35"
          />
          <kbd className="border border-black/10 px-1.5 py-0.5 font-mono text-[10px] text-black/35">
            Esc
          </kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto px-4 py-4">
          {results.length ? (
            groups.map((group) => {
              const items = results.filter((i) => i.group === group.id);
              if (!items.length) return null;
              return (
                <div key={group.id} className="mb-4">
                  <p className="px-2 pb-2 pt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
                    {group.label}
                  </p>
                  {items.map((item) => {
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
                          <span className="border border-black/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
                            {count}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <p className="px-3 py-14 text-center text-[15px] text-black/40">
              No matches for “{query}”
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
