import { currentUser } from "@clerk/nextjs/server";
import AdminNav from "@/components/AdminNav";
import { ToastProvider } from "@/components/ToastProvider";
import { resolveAdminRole } from "@/lib/admin-auth";
import { ui } from "@/components/system/tokens";

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
      <div className="min-h-screen overflow-x-hidden bg-[#f7f7f5] text-black">
        <AdminNav initialRole={userRole} />
        <div className={`w-full ${ui.shellAsidePad}`}>
          <main className={ui.shellMain}>{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
