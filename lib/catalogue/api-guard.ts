import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth/require-admin";
import type { Permission } from "@/lib/authz/permissions";

export async function withCatalogueAuth(permission: Permission) {
  try {
    return await requireAdminPermission(permission);
  } catch (e) {
    const err = e as Error & { status?: number };
    throw Object.assign(new Error(err.message || "Unauthorized"), {
      status: err.status || 401,
    });
  }
}

export function jsonError(err: unknown) {
  const e = err as Error & { status?: number; completeness?: unknown };
  const status = e.status || 500;
  return NextResponse.json(
    {
      error: e.message || "Request failed",
      completeness: e.completeness,
    },
    { status },
  );
}
