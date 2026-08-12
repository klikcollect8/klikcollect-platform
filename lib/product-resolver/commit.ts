import { normaliseBarcode } from "@/lib/catalogue/barcode-normalize";
import {
  upsertDraftProduct,
  upsertProductMedia,
} from "@/lib/catalogue/admin-store";
import { writeProductAudit } from "@/lib/catalogue/audit";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { findLocalProductByBarcode } from "@/lib/product-resolver/providers/klikcollect";
import { importExternalProductImage } from "@/lib/product-resolver/images";
import { markDiscoveryImported } from "@/lib/product-resolver/discovery";
import { mapPerishabilityToDb } from "@/lib/product-resolver/merge";
import type {
  CandidateImage,
  ResolveCommitInput,
} from "@/lib/product-resolver/types";
import type { CatalogueDraft } from "@/lib/catalogue/product-draft";

function mapMediaRole(
  role: CandidateImage["role"] | string | undefined,
  isFirst: boolean,
): NonNullable<CatalogueDraft["media"]>[number]["role"] {
  if (role === "front") return isFirst ? "main" : "gallery";
  if (
    role === "ingredients" ||
    role === "nutrition" ||
    role === "packaging" ||
    role === "main" ||
    role === "gallery" ||
    role === "variant"
  ) {
    return role;
  }
  return isFirst ? "main" : "gallery";
}

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
  const normalised = normaliseBarcode(input.barcode, {
    requireGtin: !input.allowInvalidBarcode,
  });
  if (!normalised.valid && !input.allowInvalidBarcode) {
    return { ok: false, duplicate: false, error: normalised.error || "Invalid barcode" };
  }
  const barcode =
    normalised.value ||
    input.barcode.replace(/\D/g, "") ||
    input.barcode.trim();
  if (!barcode || barcode.length < 6) {
    return { ok: false, duplicate: false, error: "Barcode is required." };
  }
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
    await markDiscoveryImported({
      barcode,
      discoveryId: input.discoveryId,
      productPublicId: existing.id,
    });
    return {
      ok: false,
      duplicate: true,
      productId: existing.id,
      error: "Product already exists for this barcode.",
    };
  }

  // Import all external images
  const importedUrls: string[] = [];
  const media: NonNullable<CatalogueDraft["media"]> = [];
  const roleMap = input.imageRoles?.length
    ? input.imageRoles
    : [
        ...(input.imageUrl
          ? [{ url: input.imageUrl, role: "front" as const }]
          : []),
        ...(input.images || []).map((url) => ({
          url,
          role: "gallery" as const,
        })),
      ];

  const seen = new Set<string>();
  for (const item of roleMap) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    let finalUrl = item.url;
    if (
      item.url.startsWith("https://") &&
      !item.url.includes("supabase") &&
      !item.url.includes("/storage/")
    ) {
      const imported = await importExternalProductImage(item.url);
      if (imported) finalUrl = imported.url;
      else continue;
    }
    importedUrls.push(finalUrl);
    media.push({
      url: finalUrl,
      role: mapMediaRole(item.role, media.length === 0),
      sortOrder: media.length,
    });
  }

  const imageUrl = media[0]?.url || null;

  const attributes: Record<string, string> = {
    ...(input.attributes || {}),
  };
  if (input.ingredients) attributes.ingredients = input.ingredients;
  if (input.allergens) attributes.allergens = input.allergens;
  if (input.additives) attributes.additives = input.additives;
  if (input.traces) attributes.traces = input.traces;
  if (input.quantity) attributes.quantity = input.quantity;
  if (input.unit) attributes.unit = input.unit;
  if (input.packaging) attributes.packaging = input.packaging;
  if (input.servingSize) attributes.serving_size = input.servingSize;
  if (input.nutriscore) attributes.nutriscore = input.nutriscore;
  if (input.novaGroup) attributes.nova_group = input.novaGroup;
  if (input.ecoscore) attributes.ecoscore = input.ecoscore;
  if (input.origins) attributes.origins = input.origins;
  if (input.labels?.length) attributes.labels = input.labels.join(" | ");
  if (input.countries?.length)
    attributes.countries = input.countries.join(" | ");
  if (input.stores?.length) attributes.stores = input.stores.join(" | ");
  if (input.externalCategories?.length) {
    attributes.external_categories = input.externalCategories.join(" | ");
  }
  if (input.nutrition) {
    try {
      attributes.nutrition_json = JSON.stringify(input.nutrition);
    } catch {
      /* ignore */
    }
  }

  const specs =
    input.specs?.filter((s) => s.key && s.value)?.slice(0, 60) || [];

  const longDescription =
    input.longDescription ||
    input.ingredients ||
    input.description ||
    null;

  const draft: CatalogueDraft = {
    name: input.name.trim(),
    brandId: input.brandId || null,
    brandName: input.brand || null,
    manufacturer: input.manufacturer || null,
    barcode,
    gtin: barcode,
    categoryId: input.categoryId,
    description: input.description || input.name.trim(),
    longDescription: longDescription || undefined,
    attributes,
    specs,
    perishability: mapPerishabilityToDb(input.perishability),
    saleUnit: input.saleUnit || "each",
    imageUrl,
    images: importedUrls.length ? importedUrls : imageUrl ? [imageUrl] : [],
    media,
    productKind: input.productKind || "packaged_grocery",
    status: input.status || "pending_review",
    duplicateAck: input.duplicateAck,
  };

  try {
    const product = await upsertDraftProduct(draft, actor);
    const productId = String(product.id || product.publicId);

    if (media.length) {
      try {
        await upsertProductMedia(productId, media, actor);
      } catch (err) {
        console.error("[commitResolvedProduct] media", err);
      }
    }

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

    await markDiscoveryImported({
      barcode,
      discoveryId: input.discoveryId,
      productPublicId: productId,
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
        attributeKeys: Object.keys(attributes),
        mediaCount: media.length,
      },
    });

    return { ok: true, productId, created: true, duplicate: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create product";
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
