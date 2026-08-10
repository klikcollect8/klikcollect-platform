"use client";

import Link from "next/link";
import { useWorkspaceAccess } from "@/lib/hooks/useWorkspaceAccess";
import type { RoleChromePlane } from "@/lib/workspace/role-chrome";
import { cn } from "@/lib/utils";

/** Literal classes so Tailwind JIT never drops role accents. */
const PLANE_BG: Record<RoleChromePlane, string> = {
  vendor: "bg-sky-800",
  driver: "bg-emerald-800",
  store: "bg-amber-700",
  warehouse: "bg-teal-800",
  finance: "bg-slate-700",
  support: "bg-violet-900",
  platform_admin: "bg-indigo-950",
  unknown: "bg-neutral-900",
};

/**
 * Thin workspace strip for signed-in staff.
 * Lives in the docked top chrome above the header (never under it).
 * Sole storefront entry to /app|/admin.
 */
export default function WorkspaceAccessBanner() {
  const {
    loading,
    signedIn,
    vendor,
    admin,
    roleLabel,
    platformRoleLabel,
    chrome,
  } = useWorkspaceAccess();

  if (loading || !signedIn || (!vendor && !admin)) return null;

  const plane: RoleChromePlane =
    chrome?.plane || (admin ? "platform_admin" : vendor ? "vendor" : "unknown");
  const accentBg = PLANE_BG[plane] || PLANE_BG.unknown;
  const href = chrome?.href || (vendor ? "/app" : "/admin");
  const hrefLabel = chrome?.hrefLabel || (vendor ? "Open" : "Admin");

  const title =
    plane === "driver"
      ? `Driver${roleLabel ? ` · ${roleLabel}` : ""}`
      : plane === "store"
        ? `Store${roleLabel ? ` · ${roleLabel}` : ""}`
        : vendor && admin
          ? `Business + admin${roleLabel ? ` · ${roleLabel}` : ""}`
          : vendor
            ? `${chrome?.label || "Business"}${roleLabel ? ` · ${roleLabel}` : ""}`
            : `${chrome?.label || "Platform"}${platformRoleLabel ? ` · ${platformRoleLabel}` : ""}`;

  return (
    <div
      className={cn("border-b border-black/10 text-white", accentBg)}
      data-kc-workspace-banner=""
    >
      <div className="mx-auto flex h-7 w-full max-w-[1600px] items-center gap-2 px-3 sm:px-10 lg:px-14 xl:px-20">
        <p className="min-w-0 flex-1 truncate text-[10px] leading-none tracking-[0.04em] text-white/75">
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-0">
          {vendor ? (
            <Link
              href={href}
              className="inline-flex h-6 items-center px-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white underline decoration-white/35 underline-offset-2 transition-opacity hover:opacity-70"
            >
              {hrefLabel}
            </Link>
          ) : null}
          {admin ? (
            <Link
              href="/admin"
              className="inline-flex h-6 items-center px-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white underline decoration-white/35 underline-offset-2 transition-opacity hover:opacity-70"
            >
              Admin
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
