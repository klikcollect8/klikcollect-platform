import type { Permission } from "@/lib/authz/permissions";

/**
 * Constitutional safeguards - Platform Admin (and below) cannot hold these.
 * Only super_admin (or privileged system paths) may exercise them.
 */
export const CONSTITUTIONAL_DENIALS = [
  "ledger:delete_immutable",
  "ledger:bypass",
  "authz:bypass",
  "audit:modify_history",
] as const satisfies readonly Permission[];

export type ConstitutionalDenial = (typeof CONSTITUTIONAL_DENIALS)[number];

export function isConstitutionalDenial(
  permission: string,
): permission is ConstitutionalDenial {
  return (CONSTITUTIONAL_DENIALS as readonly string[]).includes(permission);
}

/**
 * Strip constitutional permissions unless the actor is super_admin.
 */
export function applyConstitutionalFilter(
  permissions: Iterable<Permission>,
  isSuperAdmin: boolean,
): Set<Permission> {
  const set = new Set<Permission>(permissions);
  if (isSuperAdmin) return set;
  for (const denied of CONSTITUTIONAL_DENIALS) {
    set.delete(denied);
  }
  return set;
}
