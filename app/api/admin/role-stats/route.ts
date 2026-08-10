import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  handleRequireAdminError,
  requireAdmin,
} from "@/lib/auth/require-admin";

/**
 * Role statistics — super admin only.
 */
export async function GET() {
  try {
    await requireAdmin(["super_admin"]);

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Admin client not available" },
        { status: 500 },
      );
    }

    const { data: allProfiles, error } = await adminClient
      .from("profiles")
      .select("role");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!allProfiles) {
      return NextResponse.json({
        stats: {
          totalUsers: 0,
          user: 0,
          editor: 0,
          moderator: 0,
          admin: 0,
          head_admin: 0,
          super_admin: 0,
        },
      });
    }

    const stats = {
      totalUsers: allProfiles.length,
      user: allProfiles.filter((p) => p.role === "user").length,
      editor: allProfiles.filter((p) => p.role === "editor").length,
      moderator: allProfiles.filter((p) => p.role === "moderator").length,
      admin: allProfiles.filter((p) => p.role === "admin").length,
      head_admin: allProfiles.filter((p) => p.role === "head_admin").length,
      super_admin: allProfiles.filter((p) => p.role === "super_admin").length,
    };

    return NextResponse.json({ stats });
  } catch (error: unknown) {
    return handleRequireAdminError(error);
  }
}
