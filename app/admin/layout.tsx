import { currentUser } from "@clerk/nextjs/server";
import { ToastProvider } from "@/components/ToastProvider";
import AdminShell from "@/components/admin/AdminShell";
import { resolveAdminRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userRole: string | null = null;
  try {
    const user = await currentUser();
    userRole = user ? await resolveAdminRole(user) : null;
  } catch {
    userRole = null;
  }

  return (
    <ToastProvider>
      <AdminShell initialRole={userRole}>{children}</AdminShell>
    </ToastProvider>
  );
}
