import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { clerkEmail, isAdminRole, resolveAdminRole } from "@/lib/admin-auth";

/**
 * Current admin role — Clerk identity, KlikCollect authorization.
 * Soft-fails to JSON (never HTML) so AccessControl does not crash.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({
        authenticated: false,
        role: null,
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
      // Session exists but Clerk user fetch timed out — still authenticated.
      const email =
        typeof session.sessionClaims?.email === "string"
          ? session.sessionClaims.email
          : null;
      const allowlist = (process.env.PLATFORM_ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const role =
        email && allowlist.includes(email.toLowerCase()) ? "head_admin" : null;
      return NextResponse.json({
        authenticated: true,
        role,
        isAdmin: !!role,
        isRegularUser: !role,
        user: { id: session.userId, email, user_metadata: { full_name: email } },
      });
    }

    const role = await resolveAdminRole(user);
    const email = clerkEmail(user);
    const isAdmin = isAdminRole(role);

    return NextResponse.json({
      authenticated: true,
      role,
      isAdmin,
      isRegularUser: !isAdmin,
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
        isRegularUser: true,
        error: message,
      },
      { status: 200 },
    );
  }
}
