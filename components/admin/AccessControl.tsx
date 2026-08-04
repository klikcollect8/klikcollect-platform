"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle } from "lucide-react";
import {
  migrateLegacyPlatformRole,
  type PlatformRole,
} from "@/lib/authz/role-ids";

type RoleInput = PlatformRole | "head_admin" | "admin" | "editor" | "moderator";

interface AccessControlProps {
  allowedRoles?: RoleInput[];
  requiredPermission?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function normalizeRole(role: string): string {
  return migrateLegacyPlatformRole(role) || role.trim().toLowerCase();
}

/**
 * Client-side AccessControl for UX only.
 * No soft-open: missing role/permission = access denied.
 */
export default function AccessControl({
  allowedRoles = [],
  requiredPermission,
  children,
  fallback,
}: AccessControlProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await fetch("/api/admin/current-role");
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          setUserRole(null);
          return;
        }
        const data = await response.json();

        if (!data.authenticated) {
          setUserRole(null);
          router.push("/admin/login");
          return;
        }

        setUserRole(data.role ? normalizeRole(String(data.role)) : null);
        if (Array.isArray(data.permissions)) {
          setPermissions(data.permissions.map(String));
        }
      } catch {
        setUserRole(null);
      } finally {
        setChecking(false);
      }
    };

    void checkAccess();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--kc-ink)] border-t-transparent" />
      </div>
    );
  }

  const normalizedUserRole = userRole ? normalizeRole(userRole) : null;
  const normalizedAllowedRoles = allowedRoles.map((r) => normalizeRole(r));
  const roleOk =
    normalizedUserRole !== null &&
    (normalizedAllowedRoles.length === 0 ||
      normalizedAllowedRoles.includes(normalizedUserRole) ||
      normalizedUserRole === "super_admin");

  const permOk =
    !requiredPermission ||
    normalizedUserRole === "super_admin" ||
    permissions.includes(requiredPermission);

  const hasAccess = roleOk && permOk;

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md px-4 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04]">
            <AlertCircle className="h-7 w-7 text-black/55" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--kc-ink)]">
            Access denied
          </h2>
          <p className="mt-2 text-sm text-[var(--kc-mute)]">
            {requiredPermission
              ? `Requires permission: ${requiredPermission}`
              : `This page is available to ${allowedRoles.join(", ") || "authorized staff"}.`}
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="mt-4 inline-flex items-center gap-2 rounded-[var(--kc-radius-sm)] bg-[var(--kc-ink)] px-4 py-2 text-sm font-medium text-white"
          >
            <Shield className="h-4 w-4" />
            Back to overview
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
