import {
  DELIVERY_ROLES,
  STORE_ROLES,
  VENDOR_ROLES,
  type PlatformRole,
  type StaffMembershipRole,
} from "@/lib/authz/role-ids";

export type RoleChromePlane =
  | "vendor"
  | "driver"
  | "store"
  | "platform_admin"
  | "support"
  | "finance"
  | "warehouse"
  | "unknown";

export type RoleChrome = {
  plane: RoleChromePlane;
  roleId: string | null;
  accentBg: string;
  accentText: string;
  accentMuted: string;
  label: string;
  href: string;
  hrefLabel: string;
};

const DRIVER = new Set<string>(DELIVERY_ROLES);
const STORE = new Set<string>(STORE_ROLES);
const VENDOR = new Set<string>(VENDOR_ROLES);
const WAREHOUSE = new Set([
  "warehouse_manager",
  "warehouse_staff",
  "picker",
  "packer",
]);

const SUPPORT_PLATFORM = new Set([
  "support_manager",
  "support_agent",
  "customer_success",
  "trust_safety",
]);

const FINANCE_PLATFORM = new Set(["finance_admin", "compliance_officer"]);

const ADMIN_PLATFORM = new Set([
  "super_admin",
  "platform_admin",
  "marketplace_curator",
  "content_manager",
  "platform_marketing",
  "bi_analyst",
  "developer",
]);

function planeForRole(
  staffRole: string | null | undefined,
  platformRole: string | null | undefined,
): RoleChromePlane {
  if (staffRole && DRIVER.has(staffRole)) return "driver";
  if (staffRole && STORE.has(staffRole)) return "store";
  if (staffRole && WAREHOUSE.has(staffRole)) return "warehouse";
  if (staffRole && VENDOR.has(staffRole)) return "vendor";
  if (platformRole && FINANCE_PLATFORM.has(platformRole)) return "finance";
  if (platformRole && SUPPORT_PLATFORM.has(platformRole)) return "support";
  if (platformRole && ADMIN_PLATFORM.has(platformRole)) return "platform_admin";
  if (staffRole) return "vendor";
  if (platformRole) return "platform_admin";
  return "unknown";
}

/** Prefer driver / store / warehouse over generic vendor when multiple memberships. */
export function pickPrimaryStaffRole(
  roles: Array<string | null | undefined>,
): string | null {
  const cleaned = roles.map((r) => (r ? String(r) : "")).filter(Boolean);
  if (!cleaned.length) return null;
  const rank = (r: string) => {
    if (DRIVER.has(r)) return 0;
    if (STORE.has(r)) return 1;
    if (WAREHOUSE.has(r)) return 2;
    if (VENDOR.has(r)) return 3;
    return 4;
  };
  return [...cleaned].sort((a, b) => rank(a) - rank(b))[0] || null;
}

/** Visual chrome for workspace banners / soft role dashboards. */
export function resolveRoleChrome(input: {
  staffRole?: string | null;
  platformRole?: string | null;
  hasVendor?: boolean;
  hasAdmin?: boolean;
}): RoleChrome {
  const roleId = input.staffRole || input.platformRole || null;
  const plane = planeForRole(input.staffRole, input.platformRole);

  switch (plane) {
    case "driver":
      return {
        plane,
        roleId,
        accentBg: "bg-emerald-800",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Driver",
        href: "/app/orders/packing",
        hrefLabel: "Packing & orders",
      };
    case "store":
      return {
        plane,
        roleId,
        accentBg: "bg-amber-700",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Store floor",
        href: "/app/pos",
        hrefLabel: "POS",
      };
    case "warehouse":
      return {
        plane,
        roleId,
        accentBg: "bg-teal-800",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Warehouse",
        href: "/app/warehouse",
        hrefLabel: "Warehouse",
      };
    case "finance":
      return {
        plane,
        roleId,
        accentBg: "bg-slate-700",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Finance",
        href: "/admin/finance",
        hrefLabel: "Finance",
      };
    case "support":
      return {
        plane,
        roleId,
        accentBg: "bg-violet-900",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Support",
        href: "/admin/support",
        hrefLabel: "Support",
      };
    case "platform_admin":
      return {
        plane,
        roleId,
        accentBg: "bg-indigo-950",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Platform",
        href: "/admin",
        hrefLabel: "Admin",
      };
    case "vendor":
      return {
        plane,
        roleId,
        accentBg: "bg-sky-800",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Business",
        href: "/app",
        hrefLabel: "My business",
      };
    default:
      if (input.hasAdmin) {
        return resolveRoleChrome({
          ...input,
          platformRole: input.platformRole || "platform_admin",
        });
      }
      if (input.hasVendor) {
        return resolveRoleChrome({
          ...input,
          staffRole: input.staffRole || "vendor_owner",
        });
      }
      return {
        plane: "unknown",
        roleId: null,
        accentBg: "bg-black",
        accentText: "text-white",
        accentMuted: "text-white/70",
        label: "Workspace",
        href: "/app",
        hrefLabel: "Open",
      };
  }
}

export function formatRoleLabel(roleId: string | null | undefined): string {
  if (!roleId) return "";
  return String(roleId).replace(/_/g, " ");
}

export type SoftDashboardLink = {
  href: string;
  label: string;
};

/** Fewer tiles for driver / cashier planes. */
export function softDashboardLinks(
  plane: RoleChromePlane,
): SoftDashboardLink[] | null {
  if (plane === "driver") {
    return [
      { href: "/app/orders", label: "Orders" },
      { href: "/app/orders/packing", label: "Packing" },
      { href: "/app/notifications", label: "Alerts" },
    ];
  }
  if (plane === "store") {
    return [
      { href: "/app/pos", label: "POS" },
      { href: "/app/orders", label: "Orders" },
      { href: "/app/orders/packing", label: "Packing" },
      { href: "/app/inventory", label: "Stock" },
    ];
  }
  return null;
}

export type { PlatformRole, StaffMembershipRole };
