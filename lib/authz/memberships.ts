import { getServiceSupabase } from "@/lib/supabase/admin";
import type { PlatformRole, StaffMembershipRole } from "@/lib/authz/role-ids";
import { isPlatformRole, isStaffMembershipRole } from "@/lib/authz/role-ids";

export type PlatformMembershipRow = {
  id: string;
  clerkUserId: string;
  email: string | null;
  role: PlatformRole;
  status: "active" | "invited" | "revoked";
};

export type StaffMembershipRow = {
  id: string;
  clerkUserId: string;
  email: string | null;
  vendorId: string;
  storeId: string | null;
  role: StaffMembershipRole;
  status: "active" | "invited" | "revoked";
};

function supabaseOrNull() {
  try {
    return getServiceSupabase();
  } catch {
    return null;
  }
}

export async function listPlatformMembership(
  clerkUserId: string,
): Promise<PlatformMembershipRow | null> {
  const supabase = supabaseOrNull();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("platform_memberships")
    .select("id, clerk_user_id, email, role, status")
    .eq("clerk_user_id", clerkUserId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  if (!isPlatformRole(data.role)) return null;

  return {
    id: data.id,
    clerkUserId: data.clerk_user_id,
    email: data.email,
    role: data.role,
    status: data.status,
  };
}

export async function upsertPlatformMembership(input: {
  clerkUserId: string;
  email?: string | null;
  role: PlatformRole;
  status?: "active" | "invited" | "revoked";
}): Promise<PlatformMembershipRow | null> {
  const supabase = supabaseOrNull();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("platform_memberships")
    .upsert(
      {
        clerk_user_id: input.clerkUserId,
        email: input.email ?? null,
        role: input.role,
        status: input.status ?? "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" },
    )
    .select("id, clerk_user_id, email, role, status")
    .single();

  if (error || !data || !isPlatformRole(data.role)) return null;
  return {
    id: data.id,
    clerkUserId: data.clerk_user_id,
    email: data.email,
    role: data.role,
    status: data.status,
  };
}

export async function listStaffMembershipsForClerkUser(
  clerkUserId: string,
  email?: string | null,
): Promise<StaffMembershipRow[]> {
  const supabase = supabaseOrNull();
  if (!supabase) return [];

  const query = supabase
    .from("staff_memberships")
    .select("id, clerk_user_id, email, vendor_id, store_id, role, status")
    .eq("status", "active");

  // Match by clerk id; also bind email-seeded rows
  const { data: byId, error } = await query.eq("clerk_user_id", clerkUserId);
  if (error) return [];

  const rows = byId || [];

  if (email) {
    const { data: byEmail } = await supabase
      .from("staff_memberships")
      .select("id, clerk_user_id, email, vendor_id, store_id, role, status")
      .eq("status", "active")
      .eq("email", email)
      .like("clerk_user_id", "email:%");

    if (byEmail?.length) {
      for (const row of byEmail) {
        await supabase
          .from("staff_memberships")
          .update({
            clerk_user_id: clerkUserId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        rows.push({ ...row, clerk_user_id: clerkUserId });
      }
    }
  }

  return rows
    .filter((r) => isStaffMembershipRole(r.role))
    .map((r) => ({
      id: r.id,
      clerkUserId: r.clerk_user_id,
      email: r.email ?? null,
      vendorId: r.vendor_id,
      storeId: r.store_id ?? null,
      role: r.role as StaffMembershipRole,
      status: r.status as "active" | "invited" | "revoked",
    }));
}

export async function upsertStaffMembership(input: {
  clerkUserId: string;
  email?: string | null;
  vendorId: string;
  storeId?: string | null;
  role: StaffMembershipRole;
  status?: "active" | "invited" | "revoked";
}): Promise<StaffMembershipRow | null> {
  const supabase = supabaseOrNull();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("staff_memberships")
    .upsert(
      {
        clerk_user_id: input.clerkUserId,
        email: input.email ?? null,
        vendor_id: input.vendorId,
        store_id: input.storeId ?? null,
        role: input.role,
        status: input.status ?? "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id,vendor_id" },
    )
    .select("id, clerk_user_id, email, vendor_id, store_id, role, status")
    .single();

  if (error || !data || !isStaffMembershipRole(data.role)) return null;
  return {
    id: data.id,
    clerkUserId: data.clerk_user_id,
    email: data.email,
    vendorId: data.vendor_id,
    storeId: data.store_id,
    role: data.role,
    status: data.status,
  };
}

export async function inviteStaffMembership(input: {
  email: string;
  vendorId: string;
  storeId?: string | null;
  role: StaffMembershipRole;
}): Promise<StaffMembershipRow | null> {
  return upsertStaffMembership({
    clerkUserId: `email:${input.email.toLowerCase()}`,
    email: input.email.toLowerCase(),
    vendorId: input.vendorId,
    storeId: input.storeId,
    role: input.role,
    status: "invited",
  });
}

export async function revokeStaffMembership(
  clerkUserId: string,
  vendorId: string,
): Promise<boolean> {
  const supabase = supabaseOrNull();
  if (!supabase) return false;
  const { error } = await supabase
    .from("staff_memberships")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", clerkUserId)
    .eq("vendor_id", vendorId);
  return !error;
}

export async function invitePlatformMembership(input: {
  email: string;
  role: PlatformRole;
  clerkUserId?: string;
}): Promise<PlatformMembershipRow | null> {
  return upsertPlatformMembership({
    clerkUserId: input.clerkUserId || `email:${input.email.toLowerCase()}`,
    email: input.email.toLowerCase(),
    role: input.role,
    status: input.clerkUserId ? "active" : "invited",
  });
}
