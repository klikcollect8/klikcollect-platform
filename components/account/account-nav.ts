import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CreditCard,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Settings2,
  Shield,
} from "lucide-react";

export type AccountNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const accountNav: AccountNavItem[] = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/saved", label: "Saved", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/payments", label: "Payments", icon: CreditCard },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/security", label: "Security", icon: Shield },
  { href: "/account/support", label: "Support", icon: LifeBuoy },
  { href: "/account/preferences", label: "Preferences", icon: Settings2 },
];

export function isAccountNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/account") return pathname === "/account";
  if (href === "/saved") return pathname === "/saved" || pathname.startsWith("/wishlist");
  return pathname === href || pathname.startsWith(`${href}/`);
}
