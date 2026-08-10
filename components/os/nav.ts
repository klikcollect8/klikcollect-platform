import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Settings,
  UsersRound,
  Bell,
  Wallet,
  ScanBarcode,
  MapPin,
  Store,
  PackageCheck,
  Star,
  MessageCircleQuestion,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/authz/permissions";

/**
 * Vendor workspace — “My KlikCollect Business”.
 * Platform ops stay on /admin.
 */
export type OsNavGroup =
  | "home"
  | "selling"
  | "fulfilment"
  | "store"
  | "team"
  | "money"
  | "alerts";

export type OsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  live?: boolean;
  group: OsNavGroup;
  permission?: Permission;
};

export const OS_NAV_GROUPS: { id: OsNavGroup; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "selling", label: "Selling" },
  { id: "fulfilment", label: "Fulfilment" },
  { id: "store", label: "My store" },
  { id: "team", label: "Team" },
  { id: "money", label: "Money" },
  { id: "alerts", label: "Alerts" },
];

export const osNav: OsNavItem[] = [
  {
    href: "/app",
    label: "Home",
    icon: LayoutDashboard,
    live: true,
    group: "home",
  },
  {
    href: "/app/orders",
    label: "Orders",
    icon: ShoppingBag,
    live: true,
    group: "selling",
    permission: "orders:view",
  },
  {
    href: "/app/products",
    label: "Products",
    icon: Package,
    live: true,
    group: "selling",
    permission: "offers:view",
  },
  {
    href: "/app/inventory",
    label: "Stock",
    icon: Boxes,
    live: true,
    group: "selling",
    permission: "inventory:view",
  },
  {
    href: "/app/pos",
    label: "POS",
    icon: ScanBarcode,
    live: true,
    group: "selling",
    permission: "pos:sale",
  },
  {
    href: "/app/orders/packing",
    label: "Packing",
    icon: PackageCheck,
    live: true,
    group: "fulfilment",
    permission: "orders:fulfill",
  },
  {
    href: "/app/store",
    label: "Storefront",
    icon: Store,
    live: true,
    group: "store",
    permission: "vendor:settings",
  },
  {
    href: "/app/store/hours",
    label: "Hours",
    icon: Clock,
    live: true,
    group: "store",
    permission: "vendor:settings",
  },
  {
    href: "/app/branches",
    label: "Branches",
    icon: MapPin,
    live: true,
    group: "store",
    permission: "branches:view",
  },
  {
    href: "/app/questions",
    label: "Questions",
    icon: MessageCircleQuestion,
    live: true,
    group: "store",
    permission: "content:moderate",
  },
  {
    href: "/app/reviews",
    label: "Reviews",
    icon: Star,
    live: true,
    group: "store",
    permission: "content:moderate",
  },
  {
    href: "/app/staff",
    label: "Staff",
    icon: UsersRound,
    live: true,
    group: "team",
    permission: "staff:view",
  },
  {
    href: "/app/finance",
    label: "Balance",
    icon: Wallet,
    live: true,
    group: "money",
    permission: "finance:statements",
  },
  // Stripe Connect demoted — Paystack ledger wallet is primary for KE
  // (route kept at /app/payments for legacy; redirected in OS_PLATFORM_REDIRECTS)
  {
    href: "/app/notifications",
    label: "Notifications",
    icon: Bell,
    live: true,
    group: "alerts",
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
    live: true,
    group: "alerts",
    permission: "vendor:settings",
  },
];

export type OsNavMatch = {
  label: string;
  groupLabel: string;
  href: string;
};

function osNavHrefMatches(pathname: string, href: string): boolean {
  const base = href.split("#")[0] || href;
  if (base === "/app") return pathname === "/app";
  // Packing is a sibling under Fulfil — don't match Orders for packing routes.
  if (base === "/app/orders") {
    return (
      pathname === "/app/orders" ||
      (pathname.startsWith("/app/orders/") &&
        !pathname.startsWith("/app/orders/packing"))
    );
  }
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Best nav match for sticky mobile top-bar titles (longest href prefix wins).
 */
export function resolveOsNavMatch(pathname: string | null): OsNavMatch {
  if (!pathname) {
    return { label: "Home", groupLabel: "Home", href: "/app" };
  }
  const pathOnly = pathname.split("#")[0] || pathname;
  const groupLabel = (id: OsNavGroup) =>
    OS_NAV_GROUPS.find((g) => g.id === id)?.label || "My business";

  let best: OsNavItem | null = null;
  for (const item of osNav) {
    if (!osNavHrefMatches(pathOnly, item.href)) continue;
    const base = item.href.split("#")[0] || item.href;
    const bestBase = best ? best.href.split("#")[0] || best.href : "";
    if (!best || base.length > bestBase.length) best = item;
  }

  if (pathOnly === "/app/more") {
    return { label: "More", groupLabel: "Home", href: "/app/more" };
  }

  if (best) {
    return {
      label: best.label,
      groupLabel: groupLabel(best.group),
      href: best.href,
    };
  }

  return { label: "Home", groupLabel: "Home", href: "/app" };
}

/** Platform-only routes — bounce vendors to Admin. */
export const OS_PLATFORM_REDIRECTS: Record<string, string> = {
  "/app/marketplace": "/admin/vendors",
  "/app/curation": "/admin/vendors",
  "/app/warehouse": "/admin",
  "/app/marketing": "/admin",
  "/app/analytics": "/admin/analytics",
  "/app/kyc": "/admin/compliance",
  "/app/ai": "/app",
  "/app/customers": "/app",
  "/app/products/new": "/app/products",
  "/app/products/import": "/app/products",
  "/app/payments": "/app/finance",
};
