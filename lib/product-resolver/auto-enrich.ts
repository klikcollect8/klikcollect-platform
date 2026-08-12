/**
 * Safe automated enrichment: fill only empty catalogue fields from high-confidence
 * external sources. Never overwrites approved / non-empty identity fields.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";
import { resolveBarcode } from "@/lib/product-resolver/resolve";
import { scoreMatchConfidence } from "@/lib/product-resolver/match-confidence";
import { writeProductAudit } from "@/lib/catalogue/audit";
import { startJobRun, finishJobRun } from "@/lib/product-resolver/job-runs";

export type EnrichSummary = {
  scanned: number;
  enriched: number;
  skipped: number;
  failed: number;
  details: Array<{
    productId: string;
    barcode: string;
    status: "enriched" | "skipped" | "failed";
    fields?: string[];
    reason?: string;
  }>;
};

const SAFE_EMPTY_COLUMNS: Array<{
  column: string;
  fromCandidate: (c: NonNullable<
    Awaited<ReturnType<typeof resolveBarcode>>["candidate"]
  >) => string | null;
}> = [
  {
    column: "description",
    fromCandidate: (c) =>
      c.description?.value
        ? String(c.description.value)
        : c.ingredients?.value
          ? String(c.ingredients.value).slice(0, 800)
          : null,
  },
  {
    column: "image_url",
    fromCandidate: (c) => c.images?.[0]?.url || null,
  },
  {
    column: "manufacturer",
    fromCandidate: (c) =>
      c.manufacturer?.value
        ? String(c.manufacturer.value)
        : c.brand?.value
          ? String(c.brand.value)
          : null,
  },
  {
    column: "gtin",
    fromCandidate: (c) => (c.barcode ? String(c.barcode) : null),
  },
];

export async function runAutoEnrichment(input?: {
  limit?: number;
  actorClerkUserId?: string | null;
  dryRun?: boolean;
}): Promise<EnrichSummary> {
  const limit = Math.min(40, Math.max(1, input?.limit || 15));
  const jobId = await startJobRun({
    jobType: "enrich",
    actorClerkUserId: input?.actorClerkUserId,
  });

  const summary: EnrichSummary = {
    scanned: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  try {
    const sb = getServiceSupabase();
    const { data: products } = await sb
      .from("products")
      .select(
        "id, public_id, name, barcode, gtin, description, image_url, manufacturer, attributes, version",
      )
      .is("deleted_at", null)
      .neq("status", "archived")
      .not("barcode", "is", null)
      .or("description.is.null,description.eq.—,image_url.is.null,manufacturer.is.null,gtin.is.null")
      .order("updated_at", { ascending: true })
      .limit(limit);

    for (const product of products || []) {
      summary.scanned++;
      const barcode = String(product.barcode || "").trim();
      if (!barcode) {
        summary.skipped++;
        summary.details.push({
          productId: product.public_id,
          barcode: "",
          status: "skipped",
          reason: "No barcode",
        });
        continue;
      }

      try {
        const resolved = await resolveBarcode({
          barcode,
          skipExternal: false,
        });
        const conf = scoreMatchConfidence(resolved);
        if (conf.band !== "high" || !resolved.candidate) {
          summary.skipped++;
          summary.details.push({
            productId: product.public_id,
            barcode,
            status: "skipped",
            reason: `Confidence ${conf.band}`,
          });
          continue;
        }

        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        const filled: string[] = [];
        const attrs = {
          ...((product.attributes as Record<string, string>) || {}),
        };

        for (const rule of SAFE_EMPTY_COLUMNS) {
          const current = (product as Record<string, unknown>)[rule.column];
          const empty =
            current == null ||
            String(current).trim() === "" ||
            String(current).trim() === "—";
          if (!empty) continue;
          const next = rule.fromCandidate(resolved.candidate);
          if (!next) continue;
          if (rule.column === "gtin" && product.gtin) continue;
          patch[rule.column] = next;
          filled.push(rule.column);
        }

        // Safe attribute fills only when missing
        const c = resolved.candidate;
        const attrMap: Array<[string, string | null]> = [
          ["quantity", c.quantity?.value ? String(c.quantity.value) : null],
          [
            "ingredients",
            c.ingredients?.value ? String(c.ingredients.value) : null,
          ],
          ["nutriscore", c.nutriscore?.value ? String(c.nutriscore.value) : null],
          ["allergens", c.allergens?.value ? String(c.allergens.value) : null],
        ];
        let attrsChanged = false;
        for (const [key, val] of attrMap) {
          if (!val || attrs[key]) continue;
          attrs[key] = val;
          attrsChanged = true;
          filled.push(`attr:${key}`);
        }
        if (attrsChanged) patch.attributes = attrs;

        if (!filled.length) {
          summary.skipped++;
          summary.details.push({
            productId: product.public_id,
            barcode,
            status: "skipped",
            reason: "Nothing empty to fill",
          });
          continue;
        }

        if (!input?.dryRun) {
          patch.version = Number(product.version || 1) + 1;
          const { error } = await sb
            .from("products")
            .update(patch)
            .eq("id", product.id);
          if (error) throw new Error(error.message);

          await writeProductAudit({
            productPublicId: product.public_id,
            actorClerkUserId: input?.actorClerkUserId,
            action: "enrichment.auto_filled",
            after: { fields: filled, confidence: conf },
            reason: "High-confidence safe field enrichment",
          });
        }

        summary.enriched++;
        summary.details.push({
          productId: product.public_id,
          barcode,
          status: "enriched",
          fields: filled,
        });
      } catch (e) {
        summary.failed++;
        summary.details.push({
          productId: product.public_id,
          barcode,
          status: "failed",
          reason: e instanceof Error ? e.message : "enrich failed",
        });
      }
    }

    await finishJobRun(jobId, {
      status: summary.failed && summary.enriched ? "partial" : "ok",
      summary,
    });
    return summary;
  } catch (e) {
    await finishJobRun(jobId, {
      status: "error",
      error: e instanceof Error ? e.message : "enrich failed",
      summary,
    });
    throw e;
  }
}
