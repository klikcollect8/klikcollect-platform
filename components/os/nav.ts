import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Settings,
  UsersRound,
  Bell,
  Wallet,
  ScanBarcode,
  Truck,
  MapPin,
  Store,
  PackageCheck,
  Star,
  MessageCircleQuestion,
  type LucideIcon,
} from "lucide-react";
import { messages } from "@/messages/en-KE";
import type { Permission } from "@/lib/authz/permissions";

/**
 * Vendor commerce workspace (Phase 1).
 * Platform ops (curation, CMS, flags) stay on /admin.
 */
export type OsNavGroup =
  | "overview"
  | "catalogue"
  | "fulfil"
  | "sell"
  | "grow"
  | "money"
  | "system";

export type OsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  live?: boolean;
  group: OsNavGroup;
  permission?: Permission;
};

export const OS_NAV_GROUPS: { id: OsNavGroup; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "catalogue", label: "Catalogue" },
  { id: "fulfil", label: "Fulfil" },
  { id: "sell", label: "Sell" },
  { id: "grow", label: "Grow" },
  { id: "money", label: "Money" },
  { id: "system", label: "System" },
];

export const osNav: OsNavItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    icon: LayoutDashboard,
    live: true,
    group: "overview",
  },
  {
    href: "/app/store",
    label: "Storefront",
    icon: Store,
    live: true,
    group: "overview",
    permission: "vendor:settings",
  },
  {
    href: "/app/products",
    label: messages.os.products,
    icon: Package,
    live: true,
    group: "catalogue",
    permission: "products:view",
  },
  {
    href: "/app/inventory",
    label: messages.os.inventory,
    icon: Boxes,
    live: true,
    group: "catalogue",
    permission: "inventory:view",
  },
  {
    href: "/app/orders",
    label: messages.os.orders,
    icon: ShoppingBag,
    live: true,
    group: "fulfil",
    permission: "orders:view",
  },
  {
    href: "/app/orders/packing",
    label: "Packing",
    icon: PackageCheck,
    live: true,
    group: "fulfil",
    permission: "orders:fulfill",
  },
  {
    href: "/app/couriers",
    label: "Delivery",
    icon: Truck,
    live: true,
    group: "fulfil",
    permission: "delivery:view",
  },
  {
    href: "/app/pos",
    label: messages.os.pos,
    icon: ScanBarcode,
    live: true,
    group: "sell",
    permission: "pos:sale",
  },
  {
    href: "/app/customers",
    label: messages.os.customers,
    icon: Users,
    live: true,
    group: "grow",
    permission: "support:customers_view",
  },
  {
    href: "/app/reviews",
    label: "Reviews",
    icon: Star,
    live: true,
    group: "grow",
    permission: "content:moderate",
  },
  {
    href: "/app/questions",
    label: "Questions",
    icon: MessageCircleQuestion,
    live: true,
    group: "grow",
    permission: "content:moderate",
  },
  {
    href: "/app/branches",
    label: "Branches",
    icon: MapPin,
    live: true,
    group: "grow",
    permission: "branches:view",
  },
  {
    href: "/app/finance",
    label: "Wallet",
    icon: Wallet,
    live: true,
    group: "money",
    permission: "finance:statements",
  },
  {
    href: "/app/payments",
    label: "Payouts",
    icon: Wallet,
    live: true,
    group: "money",
    permission: "finance:statements",
  },
  {
    href: "/app/staff",
    label: "Team",
    icon: UsersRound,
    live: true,
    group: "system",
    permission: "staff:view",
  },
  {
    href: "/app/notifications",
    label: "Notifications",
    icon: Bell,
    live: true,
    group: "system",
  },
  {
    href: "/app/settings",
    label: messages.os.settings,
    icon: Settings,
    live: true,
    group: "system",
    permission: "vendor:settings",
  },
];

/** Platform-only routes - bounce vendors to Admin. */
export const OS_PLATFORM_REDIRECTS: Record<string, string> = {
  "/app/marketplace": "/admin/vendors",
  "/app/curation": "/admin/vendors",
  "/app/warehouse": "/admin",
  "/app/marketing": "/admin",
  "/app/analytics": "/admin/analytics",
  "/app/kyc": "/admin/compliance",
  "/app/ai": "/app",
};
