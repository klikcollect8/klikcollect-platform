"use client";

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
      className={`min-h-screen overflow-x-hidden text-black ${adminUi.canvas}`}
    >
      <AdminNav initialRole={initialRole} />
      <div className={`w-full ${adminUi.shellAsidePad}`}>
        <main className={`${adminUi.shellMain} max-w-none`}>{children}</main>
      </div>
    </div>
  );
}
