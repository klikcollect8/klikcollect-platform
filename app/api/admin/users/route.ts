import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/users
 * Fetches all users from the database
 * Requires admin authentication
 * Uses admin client to bypass RLS and fetch all profiles
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication (uses RLS, no service role)
    await requireAdmin([
      "super_admin",
      "platform_admin",
      "marketplace_curator",
      "support_agent",
    ]);

    // Use admin client to fetch all users (bypasses RLS)
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        {
          error: "Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      );
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, email, role, created_at, status, warnings")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("[GET /api/admin/users] Profiles error:", profilesError);
      return NextResponse.json(
        { error: profilesError.message },
        { status: 500 },
      );
    }

    // Also fetch auth users to get email if not in profiles
    const { data: authUsers, error: authError } =
      await adminClient.auth.admin.listUsers();

    if (authError) {
      console.error("[GET /api/admin/users] Auth users error:", authError);
      // Continue even if auth.users fetch fails - we have profiles
    }

    // Merge profiles with auth users to ensure we have all users
    // Some users might exist in auth.users but not in profiles (shouldn't happen after trigger, but safety)
    const usersMap = new Map(
      (profiles || []).map((profile) => [profile.id, profile]),
    );

    // Add any auth users that don't have profiles
    if (authUsers?.users) {
      authUsers.users.forEach((authUser) => {
        if (!usersMap.has(authUser.id)) {
          usersMap.set(authUser.id, {
            id: authUser.id,
            email: authUser.email || "",
            role: "customer" as const,
            created_at: authUser.created_at,
            status: undefined,
            warnings: undefined,
          });
        }
      });
    }

    const allUsers = Array.from(usersMap.values());

    return NextResponse.json({
      users: allUsers,
      count: allUsers.length,
    });
  } catch (error) {
    console.error("[GET /api/admin/users] Error:", error);
    return handleRequireAdminError(error);
  }
}
