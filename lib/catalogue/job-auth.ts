/**
 * Shared auth for catalogue background jobs (admin or Vercel cron).
 */
import { NextRequest } from "next/server";
import { requireAdminPermission } from "@/lib/auth/require-admin";

export async function requireJobAuth(req: NextRequest): Promise<{
  userId: string | null;
  via: "cron" | "admin";
}> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { userId: null, via: "cron" };
  }
  const admin = await requireAdminPermission("products:edit");
  return { userId: admin.user.id, via: "admin" };
}
