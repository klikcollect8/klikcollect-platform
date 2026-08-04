import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { clerkEmail, isAdminRole, resolveAdminRole } from "@/lib/admin-auth";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { migrateLegacyPlatformRole } from "@/lib/authz/role-ids";

/**
 * Current admin role - Clerk identity, KlikCollect authorization.
 * Soft-fails to JSON (never HTML) so AccessControl does not crash.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({
        authenticated: false,
        role: null,
        permissions: [],
        isRegularUser: true,
        error: "Not authenticated",
      });
    }

    let user = null as Awaited<ReturnType<typeof currentUser>>;
    try {
      user = await Promise.race([
        currentUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
    } catch {
      user = null;
    }

    if (!user) {
      const email =
        typeof session.sessionClaims?.email === "string"
          ? session.sessionClaims.email
          : null;
      const allowlist = (process.env.PLATFORM_ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const role =
        email && allowlist.includes(email.toLowerCase()) ? "super_admin" : null;
      return NextResponse.json({
        authenticated: true,
        role,
        permissions: [],
        isAdmin: !!role,
        isRegularUser: !role,
        user: {
          id: session.userId,
          email,
          user_metadata: { full_name: email },
        },
      });
    }

    const actor = await resolveActor(user);
    const role =
      actor.platformRole ||
      (await resolveAdminRole(user)) ||
      migrateLegacyPlatformRole(
        typeof user.publicMetadata?.role === "string"
          ? user.publicMetadata.role
          : null,
      );
    const email = clerkEmail(user);
    const isAdmin = isAdminRole(role);

    return NextResponse.json({
      authenticated: true,
      role,
      permissions: [...actor.permissions],
      isAdmin,
      isRegularUser: !isAdmin,
      isSuperAdmin: actor.isSuperAdmin,
      user: {
        id: user.id,
        email,
        user_metadata: {
          full_name:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.username ||
            email,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[current-role] Exception:", error);
    return NextResponse.json(
      {
        authenticated: false,
        role: null,
        permissions: [],
        isRegularUser: true,
        error: message,
      },
      { status: 200 },
    );
  }
}
