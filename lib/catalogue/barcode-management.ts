/**
 * Primary / additional barcode assignment with uniqueness + history.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { normaliseBarcode } from "@/lib/catalogue/barcode-normalize";
import { writeProductAudit } from "@/lib/catalogue/audit";

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((x) => String(x || "").trim()).filter(Boolean))];
}

async function findBarcodeOwner(
  barcode: string,
  excludePublicId?: string,
): Promise<{ publicId: string; name: string } | null> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("products")
    .select("public_id, name, barcode, gtin, additional_barcodes")
    .is("deleted_at", null)
    .neq("status", "archived")
    .or(`barcode.eq.${barcode},gtin.eq.${barcode}`)
    .limit(20);

  for (const row of data || []) {
    if (excludePublicId && row.public_id === excludePublicId) continue;
    if (row.barcode === barcode || row.gtin === barcode) {
      return { publicId: row.public_id, name: row.name };
    }
  }

  // additional_barcodes is jsonb — scan a broader set when needed
  const { data: extras } = await sb
    .from("products")
    .select("public_id, name, additional_barcodes")
    .is("deleted_at", null)
    .neq("status", "archived")
    .filter("additional_barcodes", "cs", `["${barcode}"]`)
    .limit(5);

  for (const row of extras || []) {
    if (excludePublicId && row.public_id === excludePublicId) continue;
    return { publicId: row.public_id, name: row.name };
  }
  return null;
}

async function writeHistory(input: {
  productPublicId: string;
  barcode: string;
  role: string;
  action: string;
  actor: { userId: string; email?: string | null };
  reason?: string;
}) {
  const sb = getServiceSupabase();
  await sb.from("product_barcode_history").insert({
    product_public_id: input.productPublicId,
    barcode: input.barcode,
    role: input.role,
    action: input.action,
    actor_clerk_user_id: input.actor.userId,
    actor_email: input.actor.email || null,
    reason: input.reason || null,
  });
}

export async function listBarcodeManagement(opts?: {
  q?: string;
  missingOnly?: boolean;
  limit?: number;
}) {
  const sb = getServiceSupabase();
  const limit = Math.min(100, Math.max(1, opts?.limit || 40));
  let q = sb
    .from("products")
    .select(
      "public_id, name, barcode, gtin, additional_barcodes, status, brand_id, updated_at",
    )
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (opts?.missingOnly) {
    q = q.is("barcode", null);
  }
  if (opts?.q?.trim()) {
    const term = opts.q.trim();
    q = q.or(
      `name.ilike.%${term}%,barcode.ilike.%${term}%,gtin.ilike.%${term}%,public_id.eq.${term}`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    publicId: row.public_id as string,
    name: row.name as string,
    barcode: (row.barcode as string) || null,
    gtin: (row.gtin as string) || null,
    additionalBarcodes: asList(row.additional_barcodes),
    status: row.status as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function getBarcodeHistory(
  productPublicId: string,
  limit = 40,
) {
  const sb = getServiceSupabase();
  const [{ data: history }, { data: scans }] = await Promise.all([
    sb
      .from("product_barcode_history")
      .select("*")
      .eq("product_public_id", productPublicId)
      .order("created_at", { ascending: false })
      .limit(limit),
    sb
      .from("barcode_scan_events")
      .select(
        "barcode, resolution_status, created_at, actor_email, resolved_product_public_id",
      )
      .eq("resolved_product_public_id", productPublicId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  return {
    assignments: history || [],
    scanEvents: scans || [],
  };
}

export async function updateProductBarcodes(input: {
  productPublicId: string;
  barcode?: string | null;
  gtin?: string | null;
  additionalBarcodes?: string[];
  actor: { userId: string; email?: string | null };
  reason?: string;
  allowInvalid?: boolean;
}) {
  const sb = getServiceSupabase();
  const { data: product, error } = await sb
    .from("products")
    .select("id, public_id, name, barcode, gtin, additional_barcodes")
    .eq("public_id", input.productPublicId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) {
    throw Object.assign(new Error("Product not found"), { status: 404 });
  }

  const before = {
    barcode: product.barcode,
    gtin: product.gtin,
    additionalBarcodes: asList(product.additional_barcodes),
  };

  const normalize = (raw: string | null | undefined) => {
    if (raw == null || String(raw).trim() === "") return null;
    const n = normaliseBarcode(String(raw), {
      requireGtin: !input.allowInvalid,
    });
    if (!n.valid && !input.allowInvalid) {
      throw Object.assign(new Error(n.error || `Invalid barcode: ${raw}`), {
        status: 400,
      });
    }
    return n.value || String(raw).replace(/\D/g, "") || String(raw).trim();
  };

  const nextBarcode =
    input.barcode !== undefined
      ? normalize(input.barcode)
      : (product.barcode as string | null);
  const nextGtin =
    input.gtin !== undefined
      ? normalize(input.gtin)
      : (product.gtin as string | null);
  const nextAdditional = (
    input.additionalBarcodes !== undefined
      ? input.additionalBarcodes
      : asList(product.additional_barcodes)
  )
    .map((c) => normalize(c))
    .filter((c): c is string => Boolean(c));

  const uniqueExtra = [
    ...new Set(
      nextAdditional.filter((c) => c !== nextBarcode && c !== nextGtin),
    ),
  ];

  for (const code of [nextBarcode, nextGtin, ...uniqueExtra]) {
    if (!code) continue;
    const owner = await findBarcodeOwner(code, input.productPublicId);
    if (owner) {
      throw Object.assign(
        new Error(
          `Barcode ${code} already on ${owner.name} (${owner.publicId})`,
        ),
        { status: 409 },
      );
    }
  }

  const { data: updated, error: updErr } = await sb
    .from("products")
    .update({
      barcode: nextBarcode,
      gtin: nextGtin,
      additional_barcodes: uniqueExtra,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id)
    .select("public_id, barcode, gtin, additional_barcodes")
    .single();
  if (updErr) throw new Error(updErr.message);

  // History diffs
  if (before.barcode !== nextBarcode) {
    if (before.barcode) {
      await writeHistory({
        productPublicId: input.productPublicId,
        barcode: String(before.barcode),
        role: "cleared",
        action: "removed",
        actor: input.actor,
        reason: input.reason,
      });
    }
    if (nextBarcode) {
      await writeHistory({
        productPublicId: input.productPublicId,
        barcode: nextBarcode,
        role: "primary",
        action: "assigned",
        actor: input.actor,
        reason: input.reason,
      });
    }
  }
  if (before.gtin !== nextGtin && nextGtin) {
    await writeHistory({
      productPublicId: input.productPublicId,
      barcode: nextGtin,
      role: "gtin",
      action: "assigned",
      actor: input.actor,
      reason: input.reason,
    });
  }
  for (const code of uniqueExtra) {
    if (!before.additionalBarcodes.includes(code)) {
      await writeHistory({
        productPublicId: input.productPublicId,
        barcode: code,
        role: "additional",
        action: "assigned",
        actor: input.actor,
        reason: input.reason,
      });
    }
  }
  for (const code of before.additionalBarcodes) {
    if (!uniqueExtra.includes(code)) {
      await writeHistory({
        productPublicId: input.productPublicId,
        barcode: code,
        role: "additional",
        action: "removed",
        actor: input.actor,
        reason: input.reason,
      });
    }
  }

  await writeProductAudit({
    productPublicId: input.productPublicId,
    actorClerkUserId: input.actor.userId,
    actorEmail: input.actor.email,
    action: "barcodes.updated",
    before,
    after: {
      barcode: nextBarcode,
      gtin: nextGtin,
      additionalBarcodes: uniqueExtra,
    },
    reason: input.reason || null,
  });

  return {
    publicId: updated.public_id as string,
    barcode: (updated.barcode as string) || null,
    gtin: (updated.gtin as string) || null,
    additionalBarcodes: asList(updated.additional_barcodes),
  };
}
