import { currentUser } from "@clerk/nextjs/server";
import AdminNav from "@/components/AdminNav";
import { ToastProvider } from "@/components/ToastProvider";
import { resolveAdminRole } from "@/lib/admin-auth";
import { adminUi } from "@/components/admin/admin-ui";

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
      <div
        className={`min-h-screen overflow-x-hidden text-black ${adminUi.canvas}`}
      >
        <AdminNav initialRole={userRole} />
        <div className={`w-full ${adminUi.shellAsidePad}`}>
          <main className={`${adminUi.shellMain} max-w-none`}>{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
