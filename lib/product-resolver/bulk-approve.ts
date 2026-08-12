/**
 * Bulk-approve high-confidence discovery candidates into the catalogue.
 */
import { resolveBarcode } from "@/lib/product-resolver/resolve";
import { commitResolvedProduct } from "@/lib/product-resolver/commit";
import { scoreMatchConfidence } from "@/lib/product-resolver/match-confidence";
import {
  getDiscoveryCandidate,
  listDiscoveryCandidates,
} from "@/lib/product-resolver/discovery";
import { candidateToAttributes } from "@/lib/product-resolver/merge";
import type { DiscoveryCandidateRow } from "@/lib/product-resolver/types";

export type BulkApproveResult = {
  attempted: number;
  created: number;
  skipped: number;
  failed: number;
  results: Array<{
    id: string;
    barcode: string | null;
    status: "created" | "skipped" | "failed";
    reason?: string;
    productId?: string;
  }>;
};

const HIGH_COMPLETENESS = 70;

export async function bulkApproveDiscoveryCandidates(input: {
  ids?: string[];
  /** Fallback category when candidate has no mapped category */
  defaultCategoryId: string;
  /** Only high-confidence by default */
  highConfidenceOnly?: boolean;
  actor: { userId: string; email?: string | null };
}): Promise<BulkApproveResult> {
  const highOnly = input.highConfidenceOnly !== false;
  if (!input.defaultCategoryId?.trim()) {
    throw Object.assign(new Error("defaultCategoryId is required"), {
      status: 400,
    });
  }

  let candidates: DiscoveryCandidateRow[] = [];
  if (input.ids?.length) {
    const rows = await Promise.all(
      input.ids.slice(0, 25).map((id) => getDiscoveryCandidate(id)),
    );
    candidates = rows.filter((c): c is DiscoveryCandidateRow => Boolean(c));
  } else {
    const listed = await listDiscoveryCandidates({
      status: "pending",
      limit: 25,
      offset: 0,
    });
    candidates = listed.items;
  }

  candidates = candidates.filter((c) => c.status === "pending");

  const out: BulkApproveResult = {
    attempted: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  for (const item of candidates) {
    if (!item.barcode) {
      out.skipped++;
      out.results.push({
        id: item.publicId,
        barcode: null,
        status: "skipped",
        reason: "Missing barcode",
      });
      continue;
    }

    const completeness = item.preview?.completeness ?? 0;
    if (highOnly && completeness < HIGH_COMPLETENESS) {
      out.skipped++;
      out.results.push({
        id: item.publicId,
        barcode: item.barcode,
        status: "skipped",
        reason: `Completeness ${completeness}% below ${HIGH_COMPLETENESS}%`,
      });
      continue;
    }

    out.attempted++;
    try {
      const resolved = await resolveBarcode({
        barcode: item.barcode,
      });

      if (resolved.localProduct) {
        out.skipped++;
        out.results.push({
          id: item.publicId,
          barcode: item.barcode,
          status: "skipped",
          reason: "Already in catalogue",
          productId: resolved.localProduct.id,
        });
        continue;
      }

      const conf = scoreMatchConfidence(resolved);

      if (highOnly && conf.band !== "high") {
        out.skipped++;
        out.results.push({
          id: item.publicId,
          barcode: item.barcode,
          status: "skipped",
          reason: `Confidence ${conf.band} — requires human review`,
        });
        continue;
      }

      const candidate = resolved.candidate;
      if (!candidate?.name?.value) {
        out.failed++;
        out.results.push({
          id: item.publicId,
          barcode: item.barcode,
          status: "failed",
          reason: "No product name from sources",
        });
        continue;
      }

      const attrs = candidateToAttributes(candidate);
      const imageUrls = (candidate.images || [])
        .map((img) => img.url)
        .filter(Boolean);
      const commit = await commitResolvedProduct(
        {
          barcode: item.barcode,
          name: String(candidate.name.value),
          brand: candidate.brand?.value
            ? String(candidate.brand.value)
            : undefined,
          categoryId: input.defaultCategoryId,
          description: candidate.description?.value
            ? String(candidate.description.value)
            : candidate.ingredients?.value
              ? String(candidate.ingredients.value).slice(0, 500)
              : undefined,
          discoveryId: item.publicId,
          attributes: attrs,
          images: imageUrls,
          imageRoles: (candidate.images || []).map((img) => ({
            url: img.url,
            role: img.role,
          })),
          quantity: candidate.quantity?.value
            ? String(candidate.quantity.value)
            : undefined,
          ingredients: candidate.ingredients?.value
            ? String(candidate.ingredients.value)
            : undefined,
          allergens: candidate.allergens?.value
            ? String(candidate.allergens.value)
            : undefined,
          nutriscore: candidate.nutriscore?.value
            ? String(candidate.nutriscore.value)
            : undefined,
          nutrition: candidate.nutrition?.value || undefined,
          specs: candidate.specs || [],
        },
        input.actor,
      );

      if (!commit.ok) {
        out.failed++;
        out.results.push({
          id: item.publicId,
          barcode: item.barcode,
          status: "failed",
          reason: commit.error,
          productId: commit.duplicate ? commit.productId : undefined,
        });
        continue;
      }

      out.created++;
      out.results.push({
        id: item.publicId,
        barcode: item.barcode,
        status: "created",
        productId: commit.productId,
      });
    } catch (e) {
      out.failed++;
      out.results.push({
        id: item.publicId,
        barcode: item.barcode,
        status: "failed",
        reason: e instanceof Error ? e.message : "Approve failed",
      });
    }
  }

  return out;
}
