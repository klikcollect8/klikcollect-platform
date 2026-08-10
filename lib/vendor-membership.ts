/**
 * Vendor membership - Postgres staff_memberships preferred; file fallback when
 * RBAC_FILE_MEMBERSHIPS=true (local M1). Soft-open demo only when RBAC_SOFT_OPEN_DEMO=true.
 */
import { promises as fs } from "fs";
import path from "path";
import type { User } from "@clerk/nextjs/server";
import { clerkEmail } from "@/lib/auth/clerk-email";
import { resolveAdminRole } from "@/lib/admin-auth";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { getAdmittedVendors } from "@/lib/admitted-vendors";
import type { StaffMembershipRole } from "@/lib/authz/role-ids";
import { isStaffMembershipRole } from "@/lib/authz/role-ids";
import {
  listStaffMembershipsForClerkUser,
  upsertStaffMembership,
} from "@/lib/authz/memberships";
import { DATA_DIR, ensureDataDir } from "@/lib/data-dir";

const FILE = "vendor-memberships.json";

/** @deprecated Prefer StaffMembershipRole - kept for file-backed rows */
export type VendorRole = "vendor_owner" | "vendor_staff" | StaffMembershipRole;

export type VendorMembership = {
  clerkUserId: string;
  email: string;
  vendorId: string;
  role: VendorRole;
  storeId?: string | null;
  createdAt: string;
};

function softOpenDemoVendor(): boolean {
  if (process.env.RBAC_SOFT_OPEN_DEMO === "true") return true;
  if (process.env.RBAC_SOFT_OPEN_DEMO === "false") return false;
  // Local M1 default: soft-open demo tenant. Production must set false.
  return process.env.NODE_ENV !== "production";
}

/** File fallback for local M1 unless explicitly disabled. */
function shouldUseFileMembershipFallback(): boolean {
  if (process.env.RBAC_FILE_MEMBERSHIPS === "false") return false;
  return true;
}

async function ensureDir() {
  await ensureDataDir();
}

async function readAll(): Promise<VendorMembership[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const data = JSON.parse(raw) as VendorMembership[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: VendorMembership[]) {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, FILE),
    JSON.stringify(rows, null, 2),
    "utf8",
  );
}

function metaVendorId(user: User): string | null {
  const v = user.publicMetadata?.vendorId;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function metaVendorRole(user: User): VendorRole | null {
  const r = user.publicMetadata?.vendorRole;
  if (typeof r === "string" && isStaffMembershipRole(r)) return r;
  if (r === "vendor_owner" || r === "vendor_staff") return r;
  return null;
}

/** Ensure demo founding tenant membership for known platform admins / seeded emails. */
export async function ensureDemoMemberships(): Promise<void> {
  const emails = (process.env.PLATFORM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length) return;

  for (const email of emails) {
    try {
      await upsertStaffMembership({
        clerkUserId: `email:${email}`,
        email,
        vendorId: DEMO_VENDOR_ID,
        role: "vendor_owner",
        status: "active",
      });
      const admitted = await getAdmittedVendors();
      const founding = admitted[0]?.id;
      if (founding) {
        await upsertStaffMembership({
          clerkUserId: `email:${email}`,
          email,
          vendorId: founding,
          role: "vendor_owner",
          status: "active",
        });
      }
    } catch {
      // DB unavailable - file fallback below
    }
  }

  if (!shouldUseFileMembershipFallback()) return;

  const rows = await readAll();
  let changed = false;
  for (const email of emails) {
    const exists = rows.some(
      (r) => r.email === email && r.vendorId === DEMO_VENDOR_ID,
    );
    if (!exists) {
      rows.push({
        clerkUserId: `email:${email}`,
        email,
        vendorId: DEMO_VENDOR_ID,
        role: "vendor_owner",
        createdAt: new Date().toISOString(),
      });
      changed = true;
    }
    const admitted = await getAdmittedVendors();
    const founding = admitted[0]?.id;
    if (
      founding &&
      !rows.some((r) => r.email === email && r.vendorId === founding)
    ) {
      rows.push({
        clerkUserId: `email:${email}`,
        email,
        vendorId: founding,
        role: "vendor_owner",
        createdAt: new Date().toISOString(),
      });
      changed = true;
    }
  }
  if (changed) await writeAll(rows);
}

export async function listMembershipsForUser(
  user: User,
): Promise<VendorMembership[]> {
  await ensureDemoMemberships();
  const email = clerkEmail(user);

  try {
    const dbRows = await listStaffMembershipsForClerkUser(user.id, email);
    if (dbRows.length) {
      return dbRows.map((r) => ({
        clerkUserId: r.clerkUserId,
        email: r.email || email || "",
        vendorId: r.vendorId,
        role: r.role,
        storeId: r.storeId,
        createdAt: new Date().toISOString(),
      }));
    }
  } catch {
    // fall through to file
  }

  if (!shouldUseFileMembershipFallback()) {
    const metaId = metaVendorId(user);
    const metaRole = metaVendorRole(user) || "vendor_owner";
    if (metaId) {
      return [
        {
          clerkUserId: user.id,
          email: email || "",
          vendorId: metaId,
          role: metaRole,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return [];
  }

  const rows = await readAll();
  const byId = rows.filter((r) => r.clerkUserId === user.id);
  const byEmail = email
    ? rows.filter(
        (r) => r.email === email && r.clerkUserId.startsWith("email:"),
      )
    : [];
  if (byEmail.length) {
    let changed = false;
    for (const row of byEmail) {
      if (row.clerkUserId.startsWith("email:")) {
        row.clerkUserId = user.id;
        changed = true;
      }
    }
    if (changed) await writeAll(rows);
  }
  const metaId = metaVendorId(user);
  const metaRole = metaVendorRole(user) || "vendor_owner";
  const fromMeta =
    metaId &&
    !rows.some((r) => r.clerkUserId === user.id && r.vendorId === metaId)
      ? [
          {
            clerkUserId: user.id,
            email: email || "",
            vendorId: metaId,
            role: metaRole,
            createdAt: new Date().toISOString(),
          } satisfies VendorMembership,
        ]
      : [];
  if (fromMeta.length) {
    await writeAll([...rows, ...fromMeta]);
  }
  return [
    ...byId,
    ...byEmail.map((r) => ({ ...r, clerkUserId: user.id })),
    ...fromMeta,
  ];
}

export async function resolveVendorAccess(user: User): Promise<{
  vendorIds: string[];
  role: VendorRole | "platform_admin";
  isPlatformAdmin: boolean;
} | null> {
  const adminRole = await resolveAdminRole(user);
  if (adminRole) {
    const admitted = await getAdmittedVendors();
    return {
      vendorIds: [DEMO_VENDOR_ID, ...admitted.map((v) => v.id)],
      role: "platform_admin",
      isPlatformAdmin: true,
    };
  }
  const memberships = await listMembershipsForUser(user);
  if (!memberships.length) {
    if (softOpenDemoVendor()) {
      return {
        vendorIds: [DEMO_VENDOR_ID],
        role: "vendor_staff",
        isPlatformAdmin: false,
      };
    }
    return null;
  }
  const role: VendorRole = memberships.some((m) => m.role === "vendor_owner")
    ? "vendor_owner"
    : memberships[0].role;
  return {
    vendorIds: [...new Set(memberships.map((m) => m.vendorId))],
    role,
    isPlatformAdmin: false,
  };
}
