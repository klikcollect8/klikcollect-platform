"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MoreHorizontal,
  Package,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { osUi } from "@/components/os/os-ui";

const TABS = [
  { href: "/app", label: "Home", icon: LayoutDashboard, match: "exact" as const },
  {
    href: "/app/orders",
    label: "Orders",
    icon: ShoppingBag,
    match: "orders" as const,
  },
  {
    href: "/app/products",
    label: "Products",
    icon: Package,
    match: "prefix" as const,
  },
  { href: "/app/more", label: "More", icon: MoreHorizontal, match: "more" as const },
] as const;

function tabActive(pathname: string | null, match: (typeof TABS)[number]["match"], href: string) {
  if (!pathname) return false;
  if (match === "exact") return pathname === href;
  if (match === "orders") {
    return (
      pathname === "/app/orders" ||
      (pathname.startsWith("/app/orders/") &&
        !pathname.startsWith("/app/orders/packing"))
    );
  }
  if (match === "more") {
    if (pathname === "/app/more") return true;
    if (pathname.startsWith("/app/orders/packing")) return true;
    return [
      "/app/inventory",
      "/app/pos",
      "/app/store",
      "/app/branches",
      "/app/questions",
      "/app/reviews",
      "/app/staff",
      "/app/finance",
      "/app/notifications",
      "/app/settings",
    ].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function OsBottomTabs({
  counts,
}: {
  counts?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <nav className={osUi.bottomTabs} aria-label="Primary">
      <div className="mx-auto flex h-14 max-w-[1600px] items-stretch justify-around px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tabActive(pathname, tab.match, tab.href);
          const count =
            tab.href === "/app/orders" ? counts?.["/app/orders"] : undefined;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
                active ? "text-black" : "text-black/35",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 1.75 : 1.5} />
                {typeof count === "number" && count > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[9px] font-medium tabular-nums leading-none text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
