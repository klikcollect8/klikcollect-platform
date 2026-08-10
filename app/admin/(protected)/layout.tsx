import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { resolveAdminRole } from "@/lib/admin-auth";
import AdminLayoutClient from "../layout-client";

export const dynamic = "force-dynamic";

/**
 * Protected admin layout - Clerk session required (proxy) + admin role required here.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) {
    redirect("/admin/login?redirect=%2Fadmin");
  }

  const role = await resolveAdminRole(user);
  if (!role) {
    // Stay in the admin auth surface so staff can switch accounts.
    redirect("/admin/login?redirect=%2Fadmin&denied=1");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
