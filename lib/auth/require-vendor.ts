import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  resolveVendorAccess,
  type VendorRole,
} from "@/lib/vendor-membership";
import { clerkEmail } from "@/lib/admin-auth";
import { unauthorizedJson, forbiddenJson } from "@/lib/auth/require-clerk-user";

export type VendorActor = {
  userId: string;
  email: string | null;
  vendorIds: string[];
  role: VendorRole | "platform_admin";
  isPlatformAdmin: boolean;
};

/** Require Clerk session + vendor (or platform admin) access for OS mutations. */
export async function requireVendorActor(): Promise<
  | { ok: true; actor: VendorActor }
  | { ok: false; response: NextResponse }
> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, response: unauthorizedJson() };
  }
  const access = await resolveVendorAccess(user);
  if (!access) {
    return {
      ok: false,
      response: forbiddenJson("No vendor membership for this account"),
    };
  }
  return {
    ok: true,
    actor: {
      userId: user.id,
      email: clerkEmail(user),
      vendorIds: access.vendorIds,
      role: access.role,
      isPlatformAdmin: access.isPlatformAdmin,
    },
  };
}
