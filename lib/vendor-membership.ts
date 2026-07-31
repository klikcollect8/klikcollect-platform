/**
 * Vendor membership (Phase A) — file-backed until staff_memberships lands in Postgres.
 * Clerk authenticates; this module authorizes vendor-scoped OS actions.
 */
import { promises as fs } from "fs";
import path from "path";
import type { User } from "@clerk/nextjs/server";
import { clerkEmail, resolveAdminRole } from "@/lib/admin-auth";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { VENDORS } from "@/lib/seed-nairobi";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = "vendor-memberships.json";

export type VendorRole = "vendor_owner" | "vendor_staff";

export type VendorMembership = {
  clerkUserId: string;
  email: string;
  vendorId: string;
  role: VendorRole;
  createdAt: string;
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
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
  await fs.writeFile(path.join(DATA_DIR, FILE), JSON.stringify(rows, null, 2), "utf8");
}

function metaVendorId(user: User): string | null {
  const v = user.publicMetadata?.vendorId;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function metaVendorRole(user: User): VendorRole | null {
  const r = user.publicMetadata?.vendorRole;
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
    // Also grant ownership on first founding vendor for OS demos
    const founding = VENDORS[0]?.id;
    if (founding && !rows.some((r) => r.email === email && r.vendorId === founding)) {
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
  const rows = await readAll();
  const email = clerkEmail(user);
  const byId = rows.filter((r) => r.clerkUserId === user.id);
  const byEmail = email
    ? rows.filter((r) => r.email === email && r.clerkUserId.startsWith("email:"))
    : [];
  // Bind email-only rows to this Clerk user on first sight
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
    metaId && !rows.some((r) => r.clerkUserId === user.id && r.vendorId === metaId)
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
  return [...byId, ...byEmail.map((r) => ({ ...r, clerkUserId: user.id })), ...fromMeta];
}

export async function resolveVendorAccess(user: User): Promise<{
  vendorIds: string[];
  role: VendorRole | "platform_admin";
  isPlatformAdmin: boolean;
} | null> {
  const adminRole = await resolveAdminRole(user);
  if (adminRole) {
    return {
      vendorIds: [DEMO_VENDOR_ID, ...VENDORS.map((v) => v.id)],
      role: "platform_admin",
      isPlatformAdmin: true,
    };
  }
  const memberships = await listMembershipsForUser(user);
  if (!memberships.length) {
    // M1 soft-open: any signed-in user may operate the demo tenant
    // until real invites exist — still scoped, not all vendors.
    return {
      vendorIds: [DEMO_VENDOR_ID],
      role: "vendor_staff",
      isPlatformAdmin: false,
    };
  }
  const role: VendorRole = memberships.some((m) => m.role === "vendor_owner")
    ? "vendor_owner"
    : "vendor_staff";
  return {
    vendorIds: [...new Set(memberships.map((m) => m.vendorId))],
    role,
    isPlatformAdmin: false,
  };
}
