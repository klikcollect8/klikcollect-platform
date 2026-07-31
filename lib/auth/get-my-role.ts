import { requireAdminUser } from "@/lib/admin-auth";

/**
 * Current admin role via Clerk (not Supabase profiles).
 */
export async function getMyRole(): Promise<string | null> {
  try {
    const access = await requireAdminUser();
    return access?.role ?? null;
  } catch {
    return null;
  }
}
