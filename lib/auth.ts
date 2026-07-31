/**
 * @deprecated Legacy helpers.
 * Prefer `lib/admin-auth.ts` and `lib/auth/require-*.ts` (Clerk).
 */
import { requireAdminUser } from "@/lib/admin-auth";

export async function isAuthenticated(): Promise<boolean> {
  try {
    return !!(await requireAdminUser());
  } catch {
    return false;
  }
}

export async function getAdminUser() {
  try {
    const access = await requireAdminUser();
    if (!access) return null;
    return {
      id: access.user.id,
      email: access.email,
      role: access.role,
    };
  } catch {
    return null;
  }
}
