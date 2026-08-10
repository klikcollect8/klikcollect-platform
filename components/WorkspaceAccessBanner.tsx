"use client";

import Link from "next/link";
import { useWorkspaceAccess } from "@/lib/hooks/useWorkspaceAccess";
import { cn } from "@/lib/utils";

/**
 * Sticky-friendly strip for signed-in vendors / platform staff.
 * Hidden for regular shoppers. Colors follow role plane.
 */
export default function WorkspaceAccessBanner() {
  const {
    loading,
    vendor,
    admin,
    roleLabel,
    platformRoleLabel,
    chrome,
  } = useWorkspaceAccess();

  if (loading || (!vendor && !admin) || !chrome) return null;

  const title =
    chrome.plane === "driver"
      ? `Driver${roleLabel ? ` · ${roleLabel}` : ""}`
      : chrome.plane === "store"
        ? `Store floor${roleLabel ? ` · ${roleLabel}` : ""}`
        : vendor && admin
          ? "Store + platform access"
          : vendor
            ? `${chrome.label}${roleLabel ? ` · ${roleLabel}` : ""}`
            : `${chrome.label}${platformRoleLabel ? ` · ${platformRoleLabel}` : ""}`;

  return (
    <div
      className={cn(
        "border-b border-black/[0.08]",
        chrome.accentBg,
        chrome.accentText,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-10 sm:py-2.5 lg:px-14 xl:px-20">
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-[11px] leading-snug sm:text-[13px]",
            chrome.accentMuted,
          )}
        >
          {title}
        </p>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {vendor ? (
            <Link
              href={chrome.href}
              className="inline-flex h-10 items-center px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] underline decoration-white/35 underline-offset-4 transition-opacity hover:opacity-70 sm:h-9 sm:px-3 sm:text-[12px]"
            >
              {chrome.hrefLabel}
            </Link>
          ) : null}
          {admin ? (
            <Link
              href="/admin"
              className="inline-flex h-10 items-center px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] underline decoration-white/35 underline-offset-4 transition-opacity hover:opacity-70 sm:h-9 sm:px-3 sm:text-[12px]"
            >
              Admin
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
