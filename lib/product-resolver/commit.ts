import { normaliseBarcode } from "@/lib/catalogue/barcode-normalize";
import { upsertDraftProduct } from "@/lib/catalogue/admin-store";
import { writeProductAudit } from "@/lib/catalogue/audit";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { findLocalProductByBarcode } from "@/lib/product-resolver/providers/klikcollect";
import { importExternalProductImage } from "@/lib/product-resolver/images";
import type { ResolveCommitInput } from "@/lib/product-resolver/types";
import type { CatalogueDraft } from "@/lib/catalogue/product-draft";

export type CommitResult =
  | {
      ok: true;
      productId: string;
      created: boolean;
      duplicate: false;
    }
  | {
      ok: false;
      duplicate: true;
      productId: string;
      error: string;
    }
  | {
      ok: false;
      duplicate: false;
      error: string;
    };

export async function commitResolvedProduct(
  input: ResolveCommitInput,
  actor: { userId: string; email?: string | null },
): Promise<CommitResult> {
  const normalised = normaliseBarcode(input.barcode, { requireGtin: true });
  if (!normalised.valid) {
    return { ok: false, duplicate: false, error: normalised.error || "Invalid barcode" };
  }
  const barcode = normalised.value;
  if (!input.name?.trim()) {
    return { ok: false, duplicate: false, error: "Product name is required." };
  }
  if (!input.categoryId?.trim()) {
    return {
      ok: false,
      duplicate: false,
      error: "KlikCollect category is required.",
    };
  }

  const existing = await findLocalProductByBarcode(barcode);
  if (existing) {
    await writeProductAudit({
      productPublicId: existing.id,
      actorClerkUserId: actor.userId,
      actorEmail: actor.email,
      action: "resolver.duplicate_blocked",
      after: { barcode },
      reason: "Barcode already exists in catalogue",
    });
    return {
      ok: false,
      duplicate: true,
      productId: existing.id,
      error: "Product already exists for this barcode.",
    };
  }

  let imageUrl = input.imageUrl || null;
  const images = [...(input.images || [])];
  if (imageUrl && imageUrl.startsWith("https://") && !imageUrl.includes("supabase")) {
    const imported = await importExternalProductImage(imageUrl);
    if (imported) {
      imageUrl = imported.url;
      images.unshift(imported.url);
    }
  }

  const attributes: Record<string, string> = {
    ...(input.attributes || {}),
  };
  if (input.ingredients) attributes.ingredients = input.ingredients;
  if (input.allergens) attributes.allergens = input.allergens;
  if (input.quantity) attributes.quantity = input.quantity;
  if (input.unit) attributes.unit = input.unit;
  if (input.externalCategories?.length) {
    attributes.external_categories = input.externalCategories.join(" | ");
  }

  const draft: CatalogueDraft = {
    name: input.name.trim(),
    brandId: input.brandId || null,
    brandName: input.brand || null,
    manufacturer: input.manufacturer || null,
    barcode,
    gtin: barcode,
    categoryId: input.categoryId,
    description: input.description || input.name.trim(),
    attributes,
    imageUrl,
    images: images.length ? images : imageUrl ? [imageUrl] : [],
    productKind: input.productKind || "packaged_grocery",
    status: input.status || "pending_review",
  };

  try {
    const product = await upsertDraftProduct(draft, actor);
    const productId = String(product.id || product.publicId);

    const sb = getServiceSupabase();
    const now = new Date().toISOString();

    for (const src of input.sources || []) {
      const { data: existingSrc } = await sb
        .from("product_external_sources")
        .select("id")
        .eq("provider", src.provider)
        .eq("barcode", barcode)
        .maybeSingle();
      if (existingSrc?.id) {
        await sb
          .from("product_external_sources")
          .update({
            product_public_id: productId,
            external_product_id: src.externalProductId || null,
            source_url: src.sourceUrl || null,
            last_fetched_at: now,
            updated_at: now,
          })
          .eq("id", existingSrc.id);
      } else {
        await sb.from("product_external_sources").insert({
          product_public_id: productId,
          provider: src.provider,
          external_product_id: src.externalProductId || null,
          barcode,
          source_url: src.sourceUrl || null,
          last_fetched_at: now,
          updated_at: now,
        });
      }
    }

    for (const field of input.fieldProvenance || []) {
      const { data: existingField } = await sb
        .from("product_field_provenance")
        .select("id")
        .eq("product_public_id", productId)
        .eq("field_key", field.fieldKey)
        .eq("provider", field.provider)
        .maybeSingle();
      const row = {
        product_public_id: productId,
        field_key: field.fieldKey,
        provider: field.provider,
        external_product_id: field.externalProductId || null,
        barcode,
        original_value: field.originalValue ?? null,
        normalised_value: field.normalisedValue ?? null,
        confidence: field.confidence || "medium",
        admin_override: Boolean(field.adminOverride),
        approved_by: actor.userId,
        approved_at: now,
        retrieved_at: now,
        updated_at: now,
      };
      if (existingField?.id) {
        await sb
          .from("product_field_provenance")
          .update(row)
          .eq("id", existingField.id);
      } else {
        await sb.from("product_field_provenance").insert(row);
      }
    }

    await sb.from("barcode_scan_events").insert({
      actor_clerk_user_id: actor.userId,
      actor_email: actor.email || null,
      barcode,
      format: input.format || normalised.format,
      resolution_status: "committed",
      resolved_product_public_id: productId,
      provider_results: input.sources || [],
    });

    await writeProductAudit({
      productPublicId: productId,
      actorClerkUserId: actor.userId,
      actorEmail: actor.email,
      action: "resolver.imported",
      after: {
        barcode,
        sources: input.sources,
        status: draft.status,
      },
    });

    return { ok: true, productId, created: true, duplicate: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create product";
    // Unique violation race
    if (/duplicate|unique|barcode/i.test(msg)) {
      const again = await findLocalProductByBarcode(barcode);
      if (again) {
        return {
          ok: false,
          duplicate: true,
          productId: again.id,
          error: "Product already exists for this barcode.",
        };
      }
    }
    return { ok: false, duplicate: false, error: msg };
  }
}
