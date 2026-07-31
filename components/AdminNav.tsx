"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Flag,
  HeartPulse,
  HelpCircle,
  Layout,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Scale,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Tag,
  Ticket,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { ui } from "@/components/system/tokens";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
  group: "platform" | "marketplace" | "support" | "system";
};

const GROUPS = [
  { id: "platform" as const, label: "Platform" },
  { id: "marketplace" as const, label: "Marketplace" },
  { id: "support" as const, label: "Support" },
  { id: "system" as const, label: "System" },
];

const ALL_ROLES = ["head_admin", "admin", "editor", "moderator"];

const allNavItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, roles: ALL_ROLES, group: "platform" },
  { href: "/admin/analytics", label: "Analytics", icon: TrendingUp, roles: ["head_admin", "admin"], group: "platform" },
  { href: "/admin/roles", label: "Team", icon: Shield, roles: ["head_admin"], group: "platform" },
  { href: "/admin/vendors", label: "Vendors", icon: Store, roles: ["head_admin", "admin", "moderator"], group: "marketplace" },
  { href: "/admin/products", label: "Products", icon: Package, roles: ["head_admin", "admin", "editor"], group: "marketplace" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, roles: ["head_admin", "admin"], group: "marketplace" },
  { href: "/admin/customers", label: "Customers", icon: Users, roles: ["head_admin", "admin"], group: "marketplace" },
  { href: "/admin/categories", label: "Categories", icon: Tag, roles: ["head_admin", "admin", "editor"], group: "marketplace" },
  { href: "/admin/homepage", label: "Homepage CMS", icon: Layout, roles: ["head_admin", "admin", "editor"], group: "marketplace" },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, roles: ["head_admin", "admin", "moderator"], group: "marketplace" },
  { href: "/admin/questions", label: "Q&A", icon: HelpCircle, roles: ["head_admin", "admin", "moderator"], group: "marketplace" },
  { href: "/admin/support", label: "Tickets", icon: Ticket, roles: ["head_admin", "admin", "moderator"], group: "support" },
  { href: "/admin/support/disputes", label: "Disputes", icon: Scale, roles: ["head_admin", "admin"], group: "support" },
  { href: "/admin/system", label: "Health", icon: HeartPulse, roles: ["head_admin", "admin"], group: "system" },
  { href: "/admin/system/flags", label: "Feature flags", icon: Flag, roles: ["head_admin"], group: "system" },
  { href: "/admin/system/logs", label: "Logs", icon: Activity, roles: ["head_admin", "admin"], group: "system" },
  { href: "/admin/profile", label: "Settings", icon: Settings, roles: ALL_ROLES, group: "system" },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav({ initialRole }: { initialRole?: string | null }) {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(initialRole || null);

  const isLogin =
    pathname === "/admin/login" || pathname?.startsWith("/admin/login");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLogin) return;
    if (initialRole) {
      setUserRole(initialRole);
      return;
    }
    void fetch("/api/admin/current-role")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.role) setUserRole(String(data.role).trim());
        else if (data.authenticated) setUserRole("admin");
      })
      .catch(() => {
        if (isSignedIn) setUserRole("admin");
      });
  }, [initialRole, isLogin, isSignedIn]);

  if (isLogin) return null;

  const normalizedRole =
    userRole?.trim().toLowerCase() || (isSignedIn ? "admin" : null);
  const navItems = normalizedRole
    ? allNavItems.filter(
        (item) =>
          item.roles.some((role) => role.trim().toLowerCase() === normalizedRole) ||
          normalizedRole === "head_admin",
      )
    : allNavItems;

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f7f5]">
      <div className="shrink-0 px-7 pb-6 pt-9">
        <Link href="/admin" onClick={onNavigate} className="block">
          <p className={ui.pageEyebrow}>Admin</p>
          <p
            className="mt-2 text-[17px] font-medium tracking-tight text-black"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Platform
          </p>
          <p className="mt-1 truncate text-[12px] text-black/35">
            {normalizedRole || "staff"}
          </p>
        </Link>
      </div>

      <nav className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {GROUPS.map((group) => {
          const items = navItems.filter((i) => i.group === group.id);
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
                      <span className="truncate">{item.label}</span>
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
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden overflow-hidden lg:flex lg:flex-col",
          ui.shellAside,
        )}
      >
        <Sidebar />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(320px,90vw)] flex-col bg-[#f7f7f5]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 z-10 p-2 text-black/40"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[#f7f7f5]/90 px-8 backdrop-blur-sm sm:px-12 lg:pl-[calc(240px+4rem)] lg:pr-16 xl:pl-[calc(240px+5rem)] xl:pr-20">
        <button
          type="button"
          className="p-1.5 text-black lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
          {user?.primaryEmailAddress?.emailAddress || "Platform"}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/admin">
              <button type="button" className={ui.btnPrimary}>
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>
    </>
  );
}
