import { NextRequest, NextResponse } from "next/server";
import { createClerkClient } from "@clerk/nextjs/server";
import {
  requireAdmin,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import {
  isPlatformRole,
  migrateLegacyPlatformRole,
  PLATFORM_ROLES,
  type PlatformRole,
} from "@/lib/authz/role-ids";
import { upsertPlatformMembership } from "@/lib/authz/memberships";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdmin(["super_admin"]);

    const body = await request.json();
    const { userId, role, email } = body as {
      userId?: string;
      role?: string;
      email?: string;
    };

    if (!userId || !role) {
      return NextResponse.json(
        { error: "userId and role are required" },
        { status: 400 },
      );
    }

    const migrated = migrateLegacyPlatformRole(role);
    const nextRole: PlatformRole | null = migrated
      ? migrated
      : isPlatformRole(role)
        ? role
        : null;

    if (!nextRole || !PLATFORM_ROLES.includes(nextRole)) {
      return NextResponse.json(
        {
          error: `Invalid role. Allowed: ${PLATFORM_ROLES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Prefer Clerk user id (user_…) over legacy UUID
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    try {
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: { role: nextRole },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Clerk update failed";
      // Still persist membership if Clerk id looks valid
      if (!String(userId).startsWith("user_")) {
        return NextResponse.json(
          {
            error:
              "Assign roles to Clerk user IDs (user_…). Legacy Supabase UUID assign is retired.",
            detail: message,
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    await upsertPlatformMembership({
      clerkUserId: userId,
      email: email || null,
      role: nextRole,
      status: "active",
    });

    return NextResponse.json({
      success: true,
      message: "Role assigned successfully",
      role: nextRole,
      assignedBy: user.id,
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "status" in error &&
      ((error as Error & { status: number }).status === 401 ||
        (error as Error & { status: number }).status === 403)
    ) {
      return handleRequireAdminError(error) as NextResponse;
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
