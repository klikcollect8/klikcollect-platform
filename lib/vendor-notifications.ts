import { getServiceSupabase } from "@/lib/supabase/admin";

/** Fan-out a panel notification to active staff on a vendor. */
export async function notifyVendorStaff(input: {
  vendorPublicId: string;
  title: string;
  body?: string;
  href?: string;
  /** Limit to these roles; omit = all active members */
  roles?: string[];
  /** Skip invited placeholder clerk ids */
  excludeClerkUserIds?: string[];
}): Promise<number> {
  if (!input.vendorPublicId || !input.title) return 0;
  const sb = getServiceSupabase();
  let q = sb
    .from("staff_memberships")
    .select("clerk_user_id, role")
    .eq("vendor_id", input.vendorPublicId)
    .eq("status", "active");
  if (input.roles?.length) q = q.in("role", input.roles);

  const { data: members } = await q;
  const exclude = new Set(input.excludeClerkUserIds || []);
  const ids = [
    ...new Set(
      (members || [])
        .map((m) => String(m.clerk_user_id || ""))
        .filter((id) => id && !id.startsWith("email:") && !exclude.has(id)),
    ),
  ];
  if (!ids.length) return 0;

  const rows = ids.map((clerk_user_id) => ({
    clerk_user_id,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
  }));
  const { error } = await sb.from("panel_notifications").insert(rows);
  if (error) return 0;
  return rows.length;
}
