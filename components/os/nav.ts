import {
  LayoutDashboard,
  Store,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  ShieldCheck,
  BarChart3,
  Settings,
  ScanBarcode,
  type LucideIcon,
} from "lucide-react";
import { messages } from "@/messages/en-KE";

export type OsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  live?: boolean;
  group: "operate" | "grow" | "system";
  /** Platform-staff only (curation). Hidden for pure vendors later. */
  platformOnly?: boolean;
};

/** M2 live modules — finance/couriers/marketing/AI stay deferred. */
export const osNav: OsNavItem[] = [
  { href: "/app", label: messages.os.overview, icon: LayoutDashboard, live: true, group: "operate" },
  { href: "/app/marketplace", label: messages.os.marketplace, icon: Store, live: true, group: "operate" },
  { href: "/app/products", label: messages.os.products, icon: Package, live: true, group: "operate" },
  { href: "/app/inventory", label: messages.os.inventory, icon: Boxes, live: true, group: "operate" },
  { href: "/app/orders", label: messages.os.orders, icon: ShoppingBag, live: true, group: "operate" },
  { href: "/app/pos", label: messages.os.pos, icon: ScanBarcode, live: true, group: "operate" },
  { href: "/app/customers", label: messages.os.customers, icon: Users, live: true, group: "operate" },
  {
    href: "/app/curation",
    label: messages.os.curation,
    icon: ShieldCheck,
    live: true,
    group: "grow",
    platformOnly: true,
  },
  { href: "/app/analytics", label: messages.os.analytics, icon: BarChart3, live: true, group: "grow" },
  { href: "/app/settings", label: messages.os.settings, icon: Settings, live: true, group: "system" },
];
