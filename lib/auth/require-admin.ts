import { currentUser } from "@clerk/nextjs/server";
import {
  ADMIN_ROLES,
  requireAdminUser,
  type AdminRole,
} from "@/lib/admin-auth";
import { resolveActor } from "@/lib/authz/resolve-actor";
import { AuthzError, hasPermission, requirePermission } from "@/lib/authz/can";
import type { Permission } from "@/lib/authz/permissions";
import type { Actor } from "@/lib/authz/actor";
import { migrateLegacyPlatformRole } from "@/lib/authz/role-ids";

export type { AdminRole };

export interface RequireAdminResult {
  user: {
    id: string;
    email: string | undefined;
  };
  role: string;
  actor: Actor;
}

function normalizeAllowedRoles(roles: AdminRole[]): AdminRole[] {
  return roles
    .map((r) => migrateLegacyPlatformRole(r) || r)
    .filter(Boolean) as AdminRole[];
}

/**
 * Require admin authentication and role via Clerk (same identity as Commerce OS).
 * Accepts legacy role names (head_admin, admin, …) and maps them.
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

  const allowed = normalizeAllowedRoles(allowedRoles);
  if (!allowed.includes(result.role)) {
    const error = new Error(
      `Forbidden: Role '${result.role}' not allowed. Required: ${allowed.join(", ")}`,
    ) as Error & { status: number };
    error.status = 403;
    throw error;
  }

  const actor = await resolveActor(result.user);

  return {
    user: {
      id: result.user.id,
      email: result.email || undefined,
    },
    role: result.role,
    actor,
  };
}

/**
 * Prefer this over role lists for new code.
 */
export async function requireAdminPermission(
  permission: Permission,
): Promise<RequireAdminResult> {
  const user = await currentUser();
  if (!user) {
    const error = new Error("Unauthorized") as Error & { status: number };
    error.status = 401;
    throw error;
  }

  const actor = await resolveActor(user);
  if (!actor.isPlatformStaff) {
    const error = new Error("Unauthorized") as Error & { status: number };
    error.status = 401;
    throw error;
  }

  try {
    requirePermission(actor, permission);
  } catch (e) {
    if (e instanceof AuthzError) {
      const error = new Error(e.message) as Error & { status: number };
      error.status = e.status;
      throw error;
    }
    throw e;
  }

  return {
    user: {
      id: actor.userId,
      email: actor.email || undefined,
    },
    role: actor.platformRole || "platform_admin",
    actor,
  };
}

export function adminHasPermission(
  actor: Actor,
  permission: Permission,
): boolean {
  return hasPermission(actor, permission);
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
