"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Bell,
  Flag,
  HeartPulse,
  HelpCircle,
  Landmark,
  Layout,
  LayoutDashboard,
  Lock,
  Menu,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Smartphone,
  SlidersHorizontal,
  Store,
  Tag,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { adminUi } from "@/components/admin/admin-ui";
import { ControlPanel } from "@/components/os/ControlPanel";
import { openInstallAppPrompt } from "@/components/InstallAppPrompt";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
  migrateLegacyPlatformRole,
  type PlatformRole,
} from "@/lib/authz/role-ids";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: PlatformRole[];
  permission?: string;
  group: "platform" | "marketplace" | "support" | "finance" | "system";
};

const GROUPS = [
  { id: "platform" as const, label: "Main menu" },
  { id: "marketplace" as const, label: "Marketplace" },
  { id: "finance" as const, label: "Finances" },
  { id: "support" as const, label: "Support" },
  { id: "system" as const, label: "System" },
];

const ALL_ROLES: PlatformRole[] = [...PLATFORM_ROLES];

const allNavItems: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ALL_ROLES,
    group: "platform",
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: TrendingUp,
    roles: [
      "super_admin",
      "platform_admin",
      "bi_analyst",
      "finance_admin",
      "customer_success",
      "platform_marketing",
    ],
    permission: "analytics:view",
    group: "platform",
  },
  {
    href: "/admin/roles",
    label: "Team",
    icon: Shield,
    roles: ["super_admin"],
    permission: "users:assign_roles",
    group: "platform",
  },
  {
    href: "/admin/vendors",
    label: "Vendors",
    icon: Store,
    roles: [
      "super_admin",
      "platform_admin",
      "compliance_officer",
      "support_agent",
      "support_manager",
      "trust_safety",
      "marketplace_curator",
      "customer_success",
    ],
    permission: "vendors:view",
    group: "marketplace",
  },
  {
    href: "/admin/products",
    label: "Catalogue",
    icon: Package,
    roles: [
      "super_admin",
      "platform_admin",
      "marketplace_curator",
      "content_manager",
    ],
    permission: "products:view",
    group: "marketplace",
  },
  {
    href: "/admin/offers",
    label: "Vendor offers",
    icon: Tag,
    roles: [
      "super_admin",
      "platform_admin",
      "marketplace_curator",
    ],
    permission: "offers:view",
    group: "marketplace",
  },
  {
    href: "/admin/catalogue-corrections",
    label: "Corrections",
    icon: HelpCircle,
    roles: [
      "super_admin",
      "platform_admin",
      "marketplace_curator",
    ],
    permission: "products:edit",
    group: "marketplace",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: ShoppingBag,
    roles: [
      "super_admin",
      "platform_admin",
      "support_agent",
      "support_manager",
      "customer_success",
      "finance_admin",
    ],
    permission: "orders:view",
    group: "marketplace",
  },
  {
    href: "/admin/deliveries",
    label: "Deliveries",
    icon: Truck,
    roles: ["super_admin", "platform_admin"],
    permission: "delivery:view",
    group: "marketplace",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: Users,
    roles: [
      "super_admin",
      "platform_admin",
      "support_agent",
      "support_manager",
      "customer_success",
      "trust_safety",
    ],
    permission: "support:customers_view",
    group: "marketplace",
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: Tag,
    roles: [
      "super_admin",
      "platform_admin",
      "marketplace_curator",
      "content_manager",
    ],
    permission: "categories:view",
    group: "marketplace",
  },
  {
    href: "/admin/homepage",
    label: "Homepage CMS",
    icon: Layout,
    roles: [
      "super_admin",
      "platform_admin",
      "marketplace_curator",
      "content_manager",
      "platform_marketing",
    ],
    permission: "cms:banners",
    group: "marketplace",
  },
  {
    href: "/admin/content-reports",
    label: "Content reports",
    icon: Flag,
    roles: [
      "super_admin",
      "platform_admin",
      "support_agent",
      "support_manager",
      "marketplace_curator",
      "trust_safety",
      "content_manager",
    ],
    permission: "content:moderate",
    group: "marketplace",
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    icon: MessageSquare,
    roles: [
      "super_admin",
      "platform_admin",
      "support_agent",
      "support_manager",
      "marketplace_curator",
      "trust_safety",
      "content_manager",
    ],
    permission: "content:moderate",
    group: "marketplace",
  },
  {
    href: "/admin/questions",
    label: "Q&A",
    icon: HelpCircle,
    roles: [
      "super_admin",
      "platform_admin",
      "support_agent",
      "support_manager",
      "marketplace_curator",
      "trust_safety",
      "content_manager",
    ],
    permission: "content:moderate",
    group: "marketplace",
  },
  {
    href: "/admin/finance",
    label: "Finance & Ledger",
    icon: Wallet,
    roles: ["super_admin", "platform_admin", "finance_admin"],
    permission: "ledger:view",
    group: "finance",
  },
  {
    href: "/admin/settlements",
    label: "Settlements",
    icon: Landmark,
    roles: ["super_admin", "platform_admin", "finance_admin"],
    permission: "finance:settlements",
    group: "finance",
  },
  {
    href: "/admin/payments",
    label: "Paystack",
    icon: Wallet,
    roles: ["super_admin", "platform_admin", "finance_admin"],
    permission: "payments:view",
    group: "finance",
  },
  {
    href: "/admin/compliance",
    label: "KYC & Compliance",
    icon: BadgeCheck,
    roles: [
      "super_admin",
      "platform_admin",
      "compliance_officer",
      "trust_safety",
    ],
    permission: "compliance:kyc_review",
    group: "finance",
  },
  {
    href: "/admin/support",
    label: "Tickets",
    icon: Ticket,
    roles: [
      "super_admin",
      "platform_admin",
      "support_agent",
      "support_manager",
      "customer_success",
    ],
    permission: "support:tickets_view",
    group: "support",
  },
  {
    href: "/admin/support/disputes",
    label: "Disputes",
    icon: Scale,
    roles: [
      "super_admin",
      "platform_admin",
      "compliance_officer",
      "support_agent",
      "support_manager",
      "trust_safety",
    ],
    permission: "compliance:disputes",
    group: "support",
  },
  {
    href: "/admin/system",
    label: "Health",
    icon: HeartPulse,
    roles: ["super_admin", "platform_admin", "developer"],
    permission: "system:health",
    group: "system",
  },
  {
    href: "/admin/system/flags",
    label: "Feature flags",
    icon: Flag,
    roles: ["super_admin", "developer"],
    permission: "flags:manage",
    group: "system",
  },
  {
    href: "/admin/system/logs",
    label: "Audit Logs",
    icon: Activity,
    roles: [
      "super_admin",
      "platform_admin",
      "compliance_officer",
      "trust_safety",
      "developer",
    ],
    permission: "audit:view",
    group: "system",
  },
  {
    href: "/admin/security",
    label: "Security Center",
    icon: Lock,
    roles: ["super_admin", "platform_admin", "trust_safety"],
    permission: "security:center",
    group: "system",
  },
  {
    href: "/admin/profile",
    label: "Settings",
    icon: Settings,
    roles: ALL_ROLES,
    group: "system",
  },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type AdminNavMatch = {
  label: string;
  groupLabel: string;
  href: string;
};

/** Best nav match for sticky mobile top-bar titles (longest href prefix wins). */
export function resolveAdminNavMatch(pathname: string | null): AdminNavMatch {
  if (!pathname) {
    return { label: "Overview", groupLabel: "Main menu", href: "/admin" };
  }
  let best: NavItem | null = null;
  for (const item of allNavItems) {
    if (!isActive(pathname, item.href)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  if (best) {
    return {
      label: best.label,
      groupLabel:
        GROUPS.find((g) => g.id === best!.group)?.label || "Platform",
      href: best.href,
    };
  }
  return { label: "Overview", groupLabel: "Main menu", href: "/admin" };
}

export default function AdminNav({
  initialRole,
}: {
  initialRole?: string | null;
}) {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(
    initialRole ? migrateLegacyPlatformRole(initialRole) || initialRole : null,
  );
  const [permissions, setPermissions] = useState<string[]>([]);

  const isLogin =
    pathname === "/admin/login" || pathname?.startsWith("/admin/login");

  useEffect(() => {
    const id = requestAnimationFrame(() => setMobileOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--admin-aside",
      collapsed ? "72px" : "260px",
    );
  }, [collapsed]);

  useEffect(() => {
    if (isLogin) return;
    if (initialRole) {
      setUserRole(migrateLegacyPlatformRole(initialRole) || initialRole);
    }
    void fetch("/api/admin/current-role")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.role) {
          setUserRole(
            migrateLegacyPlatformRole(String(data.role)) ||
              String(data.role).trim(),
          );
        } else if (data.authenticated && !data.role) {
          // Authenticated but no platform role — do not elevate to admin.
          setUserRole(null);
        }
        if (Array.isArray(data.permissions)) {
          setPermissions(data.permissions.map(String));
        }
      })
      .catch(() => {
        /* keep initialRole / null — never invent platform_admin */
      });
  }, [initialRole, isLogin, isSignedIn]);

  useEffect(() => {
    if (isLogin) return;
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
  }, [isLogin]);

  const normalizedRole =
    (userRole &&
      (migrateLegacyPlatformRole(userRole) || userRole.trim().toLowerCase())) ||
    null;

  const navItems = useMemo(() => {
    if (!normalizedRole) {
      // Until role resolves, show only ungated items (never assume admin).
      return allNavItems.filter((item) => !item.permission);
    }
    return allNavItems.filter((item) => {
      if (normalizedRole === "super_admin") return true;
      const roleOk = item.roles.includes(normalizedRole as PlatformRole);
      const permOk =
        !item.permission || permissions.includes(item.permission);
      return roleOk && permOk;
    });
  }, [normalizedRole, permissions]);

  const roleLabel =
    (normalizedRole && PLATFORM_ROLE_LABELS[normalizedRole as PlatformRole]) ||
    normalizedRole ||
    "Staff";

  const pageMatch = useMemo(
    () => resolveAdminNavMatch(pathname),
    [pathname],
  );

  // Must stay after all hooks — early return previously broke Rules of Hooks
  // when pathname flipped between /admin/login and the console.
  if (isLogin) return null;

  const renderSidebar = (onNavigate?: () => void, mobileDrawer = false) => (
    <div className="flex h-full min-h-0 flex-col bg-[var(--kc-canvas)]">
      <div
        className={cn(
          "shrink-0",
          mobileDrawer
            ? "px-7 pr-14 pt-7 pb-5"
            : collapsed
              ? "px-3 pt-8 pb-4"
              : "px-5 pt-8 pb-5",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <Link
            href="/admin"
            onClick={onNavigate}
            className={cn(
              "group min-w-0",
              collapsed && !mobileDrawer
                ? "mx-auto flex h-11 w-11 items-center justify-center border border-black/12 bg-black text-[11px] font-medium tracking-[0.08em] text-white"
                : "block",
            )}
            title="Admin dashboard"
          >
            {collapsed && !mobileDrawer ? (
              "KC"
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-black/12 bg-black text-[10px] font-medium tracking-[0.12em] text-white">
                    KC
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
                      {mobileDrawer ? "Menu" : "Admin"}
                    </p>
                    <p className="mt-0.5 truncate text-[15px] font-medium tracking-tight text-black">
                      {mobileDrawer ? "KlikCollect Admin" : "Platform"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 truncate text-[12px] text-black/40">
                  {roleLabel}
                </p>
              </>
            )}
          </Link>
          {!mobileDrawer ? (
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center text-black/35 transition-colors hover:text-black lg:inline-flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      <nav
        className={cn(
          "scrollbar-hide min-h-0 flex-1 overflow-y-auto",
          collapsed && !mobileDrawer ? "px-2 pb-4" : "px-3 pb-5",
        )}
      >
        {GROUPS.map((group) => {
          const items = navItems.filter((i) => i.group === group.id);
          if (!items.length) return null;
          return (
            <div key={group.id} className="mb-6">
              {mobileDrawer || !collapsed ? (
                <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-black/28">
                  {group.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-black/10" aria-hidden />
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      className={cn(
                        "flex min-h-10 items-center gap-2.5 rounded-none py-2.5 text-[13.5px] tracking-tight",
                        collapsed && !mobileDrawer
                          ? "justify-center px-2"
                          : "px-3",
                        active
                          ? "bg-black/[0.045] font-medium text-black"
                          : "font-medium text-black/42 transition-colors hover:bg-black/[0.03] hover:text-black",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[15px] w-[15px] shrink-0",
                          active ? "text-black" : "text-black/32",
                        )}
                        strokeWidth={active ? 1.75 : 1.5}
                      />
                      {mobileDrawer || !collapsed ? (
                        <span className="truncate">{item.label}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "shrink-0 space-y-1 border-t border-black/10 pt-3",
          collapsed && !mobileDrawer ? "px-2 pb-4" : "px-3 pb-5",
        )}
      >
        <Link
          href="/app"
          onClick={onNavigate}
          title="Open vendor workspace"
          className={cn(
            "flex min-h-10 items-center gap-2.5 py-2.5 text-[13px] font-medium text-black/45 transition-colors hover:text-black",
            collapsed && !mobileDrawer ? "justify-center px-2" : "px-3",
          )}
        >
          <Store className="h-[15px] w-[15px] shrink-0" strokeWidth={1.5} />
          {mobileDrawer || !collapsed ? (
            <span className="truncate">Vendor workspace</span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            setControlOpen(true);
          }}
          title="Control panel"
          className={cn(
            "flex min-h-10 w-full items-center gap-2.5 py-2.5 text-left text-[13px] font-medium text-black/45 transition-colors hover:text-black",
            collapsed && !mobileDrawer ? "justify-center px-2" : "px-3",
          )}
        >
          <SlidersHorizontal
            className="h-[15px] w-[15px] shrink-0"
            strokeWidth={1.5}
          />
          {mobileDrawer || !collapsed ? (
            <span className="truncate">Control panel</span>
          ) : null}
        </button>

        {mobileDrawer || !collapsed ? (
          <div className="mt-2 flex items-center gap-3 border-t border-black/[0.06] px-3 pt-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-black">
                {user?.fullName ||
                  user?.primaryEmailAddress?.emailAddress ||
                  "Staff"}
              </p>
              <p className="mt-0.5 truncate text-[11px] uppercase tracking-[0.12em] text-black/35">
                {roleLabel}
              </p>
            </div>
            <UserButton />
          </div>
        ) : (
          <div className="flex justify-center pt-2">
            <UserButton />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden overflow-hidden lg:flex lg:flex-col",
          collapsed ? "w-[72px]" : adminUi.shellAside,
        )}
      >
        {renderSidebar()}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(300px,90vw)] flex-col bg-[var(--kc-canvas)]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center text-black/40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebar(() => setMobileOpen(false), true)}
          </aside>
        </div>
      ) : null}

      <header
        className={cn(
          "sticky top-0 z-30 flex h-14 items-center gap-2 bg-[var(--kc-canvas)]/90 px-3 backdrop-blur-sm sm:gap-3 sm:px-6 lg:px-10",
          collapsed
            ? "lg:pl-[calc(72px+2.5rem)] xl:pl-[calc(72px+4rem)]"
            : "lg:pl-[calc(260px+2.5rem)] xl:pl-[calc(260px+4rem)]",
        )}
      >
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-black lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>

        <div className="min-w-0 flex-1 lg:hidden">
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-black/35">
            {normalizedRole
              ? PLATFORM_ROLE_LABELS[normalizedRole as PlatformRole] ||
                "Platform"
              : "Platform"}
          </p>
          <p
            className="truncate text-[15px] font-medium tracking-tight text-black"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {pageMatch.label}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="hidden h-9 max-w-md flex-1 items-center gap-2.5 text-[13px] text-black/35 transition-colors hover:text-black lg:flex"
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span className="flex-1 truncate text-left">Search</span>
          <kbd className="hidden font-mono text-[10px] text-black/30 sm:inline">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex h-11 w-11 items-center justify-center text-black/40 transition-colors hover:text-black lg:hidden"
            aria-label="Search"
          >
            <Search className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => openInstallAppPrompt()}
            className="flex h-11 w-11 items-center justify-center text-black/40 transition-colors hover:text-black sm:h-auto sm:w-auto sm:gap-2 sm:px-2 sm:py-2"
            title="Get the app — QR for iPhone"
          >
            <Smartphone className="h-4 w-4" strokeWidth={1.5} />
            <span className="hidden sm:inline text-[13px]">Get app</span>
          </button>
          <button
            type="button"
            onClick={() => setControlOpen(true)}
            className="hidden h-11 items-center justify-center gap-2 px-2 text-black/40 transition-colors hover:text-black sm:inline-flex"
            title="Control panel"
          >
            <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
            <span className="hidden text-[13px] lg:inline">Control</span>
          </button>
          <Link
            href="/admin/support"
            className="flex h-11 w-11 items-center justify-center text-black/40 transition-colors hover:text-black"
            aria-label="Support"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <Show when="signed-out">
            <SignInButton mode="redirect" forceRedirectUrl="/admin">
              <button type="button" className={adminUi.btnPrimary}>
                Sign in
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <div className="flex h-11 items-center">
              <UserButton />
            </div>
          </Show>
        </div>
      </header>

      {cmdOpen ? (
        <AdminCommandPalette
          items={navItems}
          onClose={() => setCmdOpen(false)}
        />
      ) : null}

      <ControlPanel
        open={controlOpen}
        onClose={() => setControlOpen(false)}
        variant="admin"
        title="Platform control"
        subtitle="Enable marketplace modules, ops planes, and dashboard widgets."
      />
    </>
  );
}

function AdminCommandPalette({
  items,
  onClose,
}: {
  items: NavItem[];
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
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to…"
            className="w-full bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            Esc
          </kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto px-3 py-3">
          {results.length ? (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[14px] font-medium text-slate-800 transition hover:bg-slate-50"
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[11px] capitalize text-slate-400">
                    {item.group}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="px-3 py-14 text-center text-[14px] text-slate-400">
              No matches for “{query}”
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
