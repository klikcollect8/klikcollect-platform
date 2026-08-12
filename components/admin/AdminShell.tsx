"use client";

import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { adminUi } from "@/components/admin/admin-ui";

/** Client shell so login ↔ console navigations correctly show/hide the sidebar. */
export default function AdminShell({
  children,
  initialRole,
}: {
  children: React.ReactNode;
  initialRole: string | null;
}) {
  const pathname = usePathname();
  const isLogin =
    pathname === "/admin/login" || Boolean(pathname?.startsWith("/admin/login"));

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div
      className={`min-h-[100dvh] overflow-x-hidden text-black ${adminUi.canvas}`}
      style={
        {
          "--admin-header-h": "56px",
          "--admin-bottom-nav-h": "72px",
        } as CSSProperties
      }
    >
      <AdminNav initialRole={initialRole} />
      <div className={`w-full ${adminUi.shellAsidePad}`}>
        <main className={`${adminUi.shellMain} max-w-none`}>{children}</main>
      </div>
    </div>
  );
}
