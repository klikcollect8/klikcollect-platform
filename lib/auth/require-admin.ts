import {
  ADMIN_ROLES,
  requireAdminUser,
  type AdminRole,
} from "@/lib/admin-auth";

export type { AdminRole };

export interface RequireAdminResult {
  user: {
    id: string;
    email: string | undefined;
  };
  role: string;
}

/**
 * Require admin authentication and role via Clerk (same identity as Commerce OS).
 */
export async function requireAdmin(
  allowedRoles: AdminRole[] = [...ADMIN_ROLES],
): Promise<RequireAdminResult> {
  const result = await requireAdminUser();

  if (!result) {
    const error = new Error("Unauthorized") as Error & { status: number };
    error.status = 401;
    throw error;
  }

  if (!allowedRoles.includes(result.role)) {
    const error = new Error(
      `Forbidden: Role '${result.role}' not allowed. Required: ${allowedRoles.join(", ")}`,
    ) as Error & { status: number };
    error.status = 403;
    throw error;
  }

  return {
    user: {
      id: result.user.id,
      email: result.email || undefined,
    },
    role: result.role,
  };
}

/**
 * Helper to convert requireAdmin errors to NextResponse
 */
export function handleRequireAdminError(error: unknown): Response {
  if (error instanceof Error && "status" in error) {
    const status = (error as Error & { status: number }).status;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Internal server error" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
