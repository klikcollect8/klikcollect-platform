"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, AlertCircle } from "lucide-react";

interface AccessControlProps {
  allowedRoles: ("head_admin" | "admin" | "editor" | "moderator")[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Client-side AccessControl for UX only.
 * Server layouts already enforce admin roles.
 */
export default function AccessControl({
  allowedRoles,
  children,
  fallback,
}: AccessControlProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await fetch("/api/admin/current-role");
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          // HTML error page — do not block the page behind Access Denied forever.
          setUserRole(allowedRoles[0] || "admin");
          return;
        }
        const data = await response.json();

        if (!data.authenticated) {
          setUserRole(null);
          router.push("/admin/login");
          return;
        }

        const role = data.role?.trim() || null;
        // Soft-open: authenticated admins who pass the server layout may
        // briefly lack a role if Clerk/allowlist is slow — don't lock them out.
        setUserRole(role || allowedRoles[0] || "admin");
      } catch {
        setUserRole(allowedRoles[0] || "admin");
      } finally {
        setChecking(false);
      }
    };

    void checkAccess();
  }, [router, allowedRoles]);

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--kc-ink)] border-t-transparent" />
      </div>
    );
  }

  const normalizedUserRole = userRole?.trim().toLowerCase() || null;
  const normalizedAllowedRoles = allowedRoles.map((r) => r.trim().toLowerCase());
  const hasAccess =
    normalizedUserRole !== null &&
    (normalizedAllowedRoles.includes(normalizedUserRole) ||
      normalizedUserRole === "head_admin");

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-md px-4 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04]">
            <AlertCircle className="h-7 w-7 text-black/55" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--kc-ink)]">Access denied</h2>
          <p className="mt-2 text-sm text-[var(--kc-mute)]">
            This page is available to {allowedRoles.join(", ")}.
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
