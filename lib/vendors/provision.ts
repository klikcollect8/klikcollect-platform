/**
 * Approve → live vendor tenant: vendors row + profile + owner membership + primary store.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { upsertStaffMembership } from "@/lib/authz/memberships";
import { publicId } from "@/lib/ids";
import { slugify } from "@/lib/supabase-catalogue";
import type { CurationApplication } from "@/lib/curation-policy";

export type ProvisionResult = {
  vendorPublicId: string;
  storePublicId: string | null;
  ownerClerkUserId: string | null;
};

function uniqueSlug(base: string, suffix: string): string {
  const s = slugify(base) || "vendor";
  return `${s}-${suffix.slice(0, 8)}`.replace(/-+/g, "-").slice(0, 64);
}

/**
 * Create or reactivate an admitted vendor from a curation application.
 * Idempotent on vendors.public_id === application.id.
 */
export async function provisionAdmittedVendor(
  app: CurationApplication,
): Promise<ProvisionResult> {
  const sb = getServiceSupabase();
  const vendorPublicId = app.id.startsWith("ven_")
    ? app.id
    : publicId("ven");
  const slug = uniqueSlug(app.businessName, vendorPublicId.replace(/^ven_/, ""));

  const { data: vendor, error: vErr } = await sb
    .from("vendors")
    .upsert(
      {
        public_id: vendorPublicId,
        slug,
        name: app.businessName,
        tagline: app.notes?.slice(0, 160) || `${app.businessName} on KlikCollect`,
        description: app.notes || null,
        status: "admitted",
        city: "Nairobi",
        neighbourhood: app.neighbourhood || "Nairobi",
        contact_email: app.contactEmail,
        contact_phone: app.contactPhone || null,
        specialty: Array.isArray(app.categories)
          ? app.categories.slice(0, 3).join(", ")
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "public_id" },
    )
    .select("id, public_id")
    .single();

  if (vErr || !vendor) {
    throw new Error(vErr?.message || "Could not create vendor");
  }

  await sb.from("vendor_profiles").upsert(
    {
      vendor_public_id: vendorPublicId,
      display_name: app.businessName,
      description: app.notes || null,
      contact_email: app.contactEmail,
      contact_phone: app.contactPhone || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "vendor_public_id" },
  );

  // Primary store if none
  let storePublicId: string | null = null;
  const { data: existingStore } = await sb
    .from("stores")
    .select("public_id")
    .eq("vendor_id", vendor.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (existingStore?.public_id) {
    storePublicId = existingStore.public_id;
  } else {
    storePublicId = publicId("sto");
    const { error: sErr } = await sb.from("stores").insert({
      public_id: storePublicId,
      vendor_id: vendor.id,
      name: `${app.businessName} — Main`,
      neighbourhood: app.neighbourhood || "Nairobi",
      address_text: app.neighbourhood || "Nairobi",
      phone: app.contactPhone || null,
      is_primary: true,
    });
    if (sErr) {
      storePublicId = null;
    }
  }

  const ownerClerkUserId = app.clerkUserId || null;
  if (ownerClerkUserId) {
    await upsertStaffMembership({
      clerkUserId: ownerClerkUserId,
      email: app.contactEmail,
      vendorId: vendorPublicId,
      storeId: null,
      role: "vendor_owner",
      status: "active",
    });
  } else if (app.contactEmail) {
    await upsertStaffMembership({
      clerkUserId: `email:${app.contactEmail.toLowerCase()}`,
      email: app.contactEmail.toLowerCase(),
      vendorId: vendorPublicId,
      storeId: null,
      role: "vendor_owner",
      status: "invited",
    });
  }

  return {
    vendorPublicId,
    storePublicId,
    ownerClerkUserId,
  };
}

/** Suspend vendor operations: status + revoke active staff memberships. */
export async function suspendVendor(vendorPublicId: string): Promise<void> {
  const sb = getServiceSupabase();
  await sb
    .from("vendors")
    .update({
      status: "suspended",
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", vendorPublicId);

  await sb
    .from("staff_memberships")
    .update({
      status: "revoked",
      updated_at: new Date().toISOString(),
    })
    .eq("vendor_id", vendorPublicId)
    .eq("status", "active");
}

/** Reactivate suspended vendor (does not auto-restore revoked memberships). */
export async function reactivateVendor(vendorPublicId: string): Promise<void> {
  const sb = getServiceSupabase();
  await sb
    .from("vendors")
    .update({
      status: "admitted",
      updated_at: new Date().toISOString(),
    })
    .eq("public_id", vendorPublicId);
}
