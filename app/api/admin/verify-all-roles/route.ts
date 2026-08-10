import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  handleRequireAdminError,
  requireAdmin,
} from "@/lib/auth/require-admin";

/**
 * Comprehensive role verification endpoint.
 * Super admin only — uses service role to inspect profiles.
 */
export async function GET() {
  try {
    await requireAdmin(["super_admin"]);

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        {
          error: "Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      );
    }

    const { data: allProfiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, email, role, status, created_at")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return NextResponse.json(
        {
          error: profilesError.message,
          code: profilesError.code,
        },
        { status: 500 },
      );
    }

    if (!allProfiles || allProfiles.length === 0) {
      return NextResponse.json({
        totalUsers: 0,
        message: "No profiles found in database",
        roles: {},
        adminUsers: [],
        regularUsers: [],
        issues: ["No users found in database"],
      });
    }

    const expectedRoles = [
      "user",
      "editor",
      "moderator",
      "admin",
      "head_admin",
      "super_admin",
      "platform_admin",
    ];
    const adminRoles = [
      "head_admin",
      "admin",
      "editor",
      "moderator",
      "super_admin",
      "platform_admin",
    ];

    const roleCounts: { [key: string]: number } = {};
    const roleUsers: { [key: string]: Array<{ email: string; id: string; status: string }> } =
      {};

    expectedRoles.forEach((role) => {
      roleCounts[role] = 0;
      roleUsers[role] = [];
    });

    allProfiles.forEach((profile) => {
      const role = profile.role || "user";
      if (!roleCounts[role]) {
        roleCounts[role] = 0;
        roleUsers[role] = [];
      }
      roleCounts[role]++;
      roleUsers[role].push({
        email: profile.email,
        id: profile.id,
        status: profile.status || "active",
      });
    });

    const adminUsers = allProfiles.filter((p) =>
      adminRoles.includes(p.role || ""),
    );
    const regularUsers = allProfiles.filter(
      (p) => !p.role || p.role === "user",
    );

    const issues: string[] = [];
    const invalidRoles = allProfiles.filter(
      (p) => p.role && !expectedRoles.includes(p.role),
    );
    const usersWithoutRoles = allProfiles.filter((p) => !p.role);

    if (
      (roleCounts["head_admin"] || 0) + (roleCounts["super_admin"] || 0) ===
      0
    ) {
      issues.push("No super_admin / head_admin users found");
    }

    if (invalidRoles.length > 0) {
      issues.push(
        `${invalidRoles.length} user(s) have unexpected roles: ${invalidRoles.map((u) => `${u.email} (${u.role})`).join(", ")}`,
      );
    }

    if (usersWithoutRoles.length > 0) {
      issues.push(
        `${usersWithoutRoles.length} user(s) without roles (will default to 'user')`,
      );
    }

    return NextResponse.json({
      success: true,
      clientType: "admin (service role - bypasses RLS)",
      totalUsers: allProfiles.length,
      roleDistribution: roleCounts,
      roles: roleUsers,
      adminUsers: adminUsers.map((u) => ({
        email: u.email,
        role: u.role,
        status: u.status || "active",
      })),
      regularUsers: regularUsers.map((u) => ({
        email: u.email,
        role: u.role || "user",
        status: u.status || "active",
      })),
      issues:
        issues.length > 0
          ? issues
          : ["No issues found - all roles are properly assigned"],
      summary: {
        totalUsers: allProfiles.length,
        adminUsers: adminUsers.length,
        regularUsers: regularUsers.length,
        headAdmins: roleCounts["head_admin"] || 0,
        superAdmins: roleCounts["super_admin"] || 0,
        admins: roleCounts["admin"] || 0,
        editors: roleCounts["editor"] || 0,
        moderators: roleCounts["moderator"] || 0,
        users: roleCounts["user"] || 0,
      },
    });
  } catch (error: unknown) {
    return handleRequireAdminError(error);
  }
}
