/**
 * Canonical product merge: survivor keeps identity; loser offers reassigned; loser archived.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { writeProductAudit } from "@/lib/catalogue/audit";
import { getAdminProductDetail } from "@/lib/catalogue/admin-store";

export type MergeFieldChoice = {
  /** Field key on products row / mapped detail */
  field: string;
  /** Take value from source (loser) instead of target (survivor) */
  fromSource: boolean;
};

export type MergeProductsInput = {
  /** Survivor — remains canonical */
  targetPublicId: string;
  /** Loser — archived after merge */
  sourcePublicId: string;
  fieldChoices?: MergeFieldChoice[];
  reason?: string;
  actor: { userId: string; email?: string | null };
};

export type MergeProductsResult = {
  targetPublicId: string;
  sourcePublicId: string;
  offersMoved: number;
  offersMerged: number;
  barcodesAdded: string[];
  archivedSource: boolean;
};

const COPYABLE_COLUMNS: Array<{
  key: string;
  column: string;
}> = [
  { key: "name", column: "name" },
  { key: "description", column: "description" },
  { key: "longDescription", column: "long_description" },
  { key: "image", column: "image_url" },
  { key: "sku", column: "sku" },
  { key: "barcode", column: "barcode" },
  { key: "gtin", column: "gtin" },
  { key: "brandName", column: "manufacturer" },
  { key: "seoTitle", column: "seo_title" },
  { key: "seoDescription", column: "seo_description" },
];

function asAdditional(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => String(x || "").trim())
    .filter((x) => x.length >= 6);
}

export async function previewMergeProducts(
  targetPublicId: string,
  sourcePublicId: string,
) {
  if (targetPublicId === sourcePublicId) {
    throw Object.assign(new Error("Cannot merge a product into itself"), {
      status: 400,
    });
  }
  const [target, source] = await Promise.all([
    getAdminProductDetail(targetPublicId),
    getAdminProductDetail(sourcePublicId),
  ]);
  if (!target || !source) {
    throw Object.assign(new Error("One or both products not found"), {
      status: 404,
    });
  }

  const conflicts: Array<{
    field: string;
    target: string | null;
    source: string | null;
  }> = [];
  for (const { key } of COPYABLE_COLUMNS) {
    const targetRec = target as Record<string, unknown>;
    const sourceRec = source as Record<string, unknown>;
    const t = targetRec[key] != null ? String(targetRec[key]) : null;
    const s = sourceRec[key] != null ? String(sourceRec[key]) : null;
    if (t && s && t !== s) {
      conflicts.push({ field: key, target: t, source: s });
    }
  }

  return {
    target,
    source,
    conflicts,
    targetOffers: (target.offers as unknown[]) || [],
    sourceOffers: (source.offers as unknown[]) || [],
  };
}

export async function mergeProducts(
  input: MergeProductsInput,
): Promise<MergeProductsResult> {
  const { targetPublicId, sourcePublicId, actor } = input;
  if (targetPublicId === sourcePublicId) {
    throw Object.assign(new Error("Cannot merge a product into itself"), {
      status: 400,
    });
  }

  const sb = getServiceSupabase();
  const [{ data: target }, { data: source }] = await Promise.all([
    sb
      .from("products")
      .select("*")
      .eq("public_id", targetPublicId)
      .is("deleted_at", null)
      .maybeSingle(),
    sb
      .from("products")
      .select("*")
      .eq("public_id", sourcePublicId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!target || !source) {
    throw Object.assign(new Error("One or both products not found"), {
      status: 404,
    });
  }
  if (source.status === "archived") {
    throw Object.assign(new Error("Source product is already archived"), {
      status: 400,
    });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    version: Number(target.version || 1) + 1,
  };

  const choices = new Map(
    (input.fieldChoices || []).map((c) => [c.field, c.fromSource]),
  );

  for (const { key, column } of COPYABLE_COLUMNS) {
    const takeSource = choices.get(key) === true;
    const targetEmpty =
      target[column] == null || String(target[column]).trim() === "";
    if (takeSource || (targetEmpty && source[column] != null)) {
      if (source[column] != null && String(source[column]).trim() !== "") {
        patch[column] = source[column];
      }
    }
  }

  // Collect barcodes from loser onto survivor additional list
  const barcodesAdded: string[] = [];
  const additional = new Set(asAdditional(target.additional_barcodes));
  for (const code of [
    source.barcode,
    source.gtin,
    ...asAdditional(source.additional_barcodes),
  ]) {
    const c = code ? String(code).trim() : "";
    if (!c || c.length < 6) continue;
    if (c === target.barcode || c === target.gtin || additional.has(c)) continue;
    // If we're moving primary barcode onto empty target via patch, skip duplicate add
    if (patch.barcode === c || patch.gtin === c) continue;
    additional.add(c);
    barcodesAdded.push(c);
  }
  if (barcodesAdded.length) {
    patch.additional_barcodes = [...additional];
  }

  // Clear unique identifiers on source before survivor update (avoid unique collisions)
  await sb
    .from("products")
    .update({
      barcode: null,
      gtin: null,
      sku: source.sku ? `${source.sku}-merged` : null,
      additional_barcodes: [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", source.id);

  const { error: targetErr } = await sb
    .from("products")
    .update(patch)
    .eq("id", target.id);
  if (targetErr) throw new Error(targetErr.message);

  // Reassign offers: move or merge on vendor+variant conflict
  const { data: sourceOffers } = await sb
    .from("product_offers")
    .select("*")
    .eq("product_id", source.id)
    .is("deleted_at", null);

  let offersMoved = 0;
  let offersMerged = 0;

  for (const offer of sourceOffers || []) {
    const variantKey =
      (offer.variant_public_id as string | null) ||
      (offer.variant_key as string | null) ||
      null;

    let existing: Record<string, unknown> | null = null;
    if (variantKey) {
      const { data } = await sb
        .from("product_offers")
        .select("*")
        .eq("product_id", target.id)
        .eq("vendor_id", offer.vendor_id)
        .eq("variant_public_id", variantKey)
        .is("deleted_at", null)
        .maybeSingle();
      existing = data;
    } else {
      const { data } = await sb
        .from("product_offers")
        .select("*")
        .eq("product_id", target.id)
        .eq("vendor_id", offer.vendor_id)
        .is("variant_public_id", null)
        .is("deleted_at", null)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      const onHand =
        Number(existing.on_hand || 0) + Number(offer.on_hand || 0);
      const reserved =
        Number(existing.reserved || 0) + Number(offer.reserved || 0);
      await sb
        .from("product_offers")
        .update({
          on_hand: onHand,
          reserved: reserved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      await sb
        .from("product_offers")
        .update({
          deleted_at: new Date().toISOString(),
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", offer.id);
      offersMerged++;
    } else {
      const { error: moveErr } = await sb
        .from("product_offers")
        .update({
          product_id: target.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", offer.id);
      if (moveErr) {
        await sb
          .from("product_offers")
          .update({
            deleted_at: new Date().toISOString(),
            status: "archived",
            updated_at: new Date().toISOString(),
          })
          .eq("id", offer.id);
      } else {
        offersMoved++;
      }
    }
  }

  // Point media at survivor where possible
  await sb
    .from("product_media")
    .update({ product_public_id: target.public_id })
    .eq("product_public_id", source.public_id)
    .is("deleted_at", null);

  // Slug redirect from loser → survivor
  if (source.slug && source.slug !== target.slug) {
    await sb.from("product_slug_redirects").upsert(
      {
        from_slug: source.slug,
        to_product_public_id: target.public_id,
      },
      { onConflict: "from_slug" },
    );
  }

  const reason =
    input.reason?.trim() ||
    `Merged into ${target.public_id} (${target.name})`;

  const { error: archErr } = await sb
    .from("products")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      search_visible: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", source.id);
  if (archErr) throw new Error(archErr.message);

  await writeProductAudit({
    productPublicId: targetPublicId,
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    action: "products.merged_into",
    before: { sourcePublicId },
    after: {
      offersMoved,
      offersMerged,
      barcodesAdded,
      fieldChoices: input.fieldChoices || [],
    },
    reason,
  });

  await writeProductAudit({
    productPublicId: sourcePublicId,
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    action: "products.merged_away",
    before: { name: source.name, barcode: source.barcode },
    after: { targetPublicId },
    reason,
  });

  return {
    targetPublicId,
    sourcePublicId,
    offersMoved,
    offersMerged,
    barcodesAdded,
    archivedSource: true,
  };
}
