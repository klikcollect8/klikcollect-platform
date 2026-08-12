import type {
  CandidateField,
  CandidateProduct,
  ProviderLookupResult,
  ResolveResult,
} from "@/lib/product-resolver/types";

export type ConfidenceBand = "high" | "medium" | "low";

export type MatchConfidence = {
  band: ConfidenceBand;
  score: number;
  label: string;
  requiresConfirmation: boolean;
};

function fieldOk(f?: CandidateField<unknown> | null): boolean {
  return Boolean(f && f.value != null && f.status !== "missing");
}

/** Aggregate match confidence for UI badges and create gates. */
export function scoreMatchConfidence(result: ResolveResult): MatchConfidence {
  if (result.localProduct) {
    return {
      band: "high",
      score: 98,
      label: "Strong match · KlikCollect",
      requiresConfirmation: false,
    };
  }

  if (result.resolutionStatus === "not_found" || !result.candidate) {
    return {
      band: "low",
      score: 12,
      label: "No reliable match",
      requiresConfirmation: true,
    };
  }

  const c = result.candidate;
  let score = 40;
  if (result.resolutionStatus === "external_found") score += 25;
  if (result.resolutionStatus === "partial") score += 10;
  if (fieldOk(c.name)) score += 12;
  if (fieldOk(c.brand)) score += 10;
  if (fieldOk(c.quantity)) score += 6;
  if (c.images?.length) score += 6;
  if (fieldOk(c.ingredients) || fieldOk(c.nutrition)) score += 5;

  const hits = (result.providerResults || []).filter((p) => p.status === "hit")
    .length;
  if (hits >= 2) score += 8;

  score = Math.max(0, Math.min(99, score));
  const band: ConfidenceBand =
    score >= 75 ? "high" : score >= 45 ? "medium" : "low";

  return {
    band,
    score,
    label:
      band === "high"
        ? "Strong match"
        : band === "medium"
          ? "Review recommended"
          : "Manual verification required",
    requiresConfirmation: band !== "high",
  };
}

export type CompareFieldRow = {
  key: string;
  label: string;
  values: Array<{
    provider: string;
    value: string | null;
    conflict: boolean;
  }>;
};

const COMPARE_FIELDS: Array<{
  key: keyof CandidateProduct | "image";
  label: string;
  get: (c: Partial<CandidateProduct>) => string | null;
}> = [
  {
    key: "name",
    label: "Name",
    get: (c) => (c.name?.value as string) || null,
  },
  {
    key: "brand",
    label: "Brand",
    get: (c) => (c.brand?.value as string) || null,
  },
  {
    key: "quantity",
    label: "Size",
    get: (c) => (c.quantity?.value as string) || null,
  },
  {
    key: "image",
    label: "Image",
    get: (c) => c.images?.[0]?.url || null,
  },
  {
    key: "ingredients",
    label: "Ingredients",
    get: (c) => (c.ingredients?.value as string) || null,
  },
  {
    key: "nutrition",
    label: "Nutrition",
    get: (c) => (c.nutrition?.value ? "Present" : null),
  },
  {
    key: "barcode",
    label: "Barcode",
    get: (c) => c.barcode || null,
  },
];

function normalizeQty(v: string | null): string | null {
  if (!v) return null;
  const s = v.toLowerCase().replace(/\s+/g, "");
  const ml = s.match(/^([\d.]+)ml$/);
  if (ml) return `${ml[1]}ml`;
  const l = s.match(/^([\d.]+)l$/);
  if (l) return `${Math.round(parseFloat(l[1]) * 1000)}ml`;
  return s;
}

/** Build field × provider compare matrix from provider results. */
export function buildSourceCompare(
  providers: ProviderLookupResult[],
): CompareFieldRow[] {
  const cols = providers.filter((p) => p.candidate || p.status === "hit");
  if (!cols.length) return [];

  return COMPARE_FIELDS.map((f) => {
    const values = cols.map((p) => {
      const raw = p.candidate ? f.get(p.candidate) : null;
      return {
        provider: p.provider,
        value: raw,
        conflict: false,
      };
    });
    const norms = values.map((v) =>
      f.key === "quantity" ? normalizeQty(v.value) : v.value?.toLowerCase().trim() || null,
    );
    const present = norms.filter(Boolean);
    const unique = new Set(present);
    const conflict = unique.size > 1;
    return {
      key: String(f.key),
      label: f.label,
      values: values.map((v) => ({ ...v, conflict })),
    };
  });
}

export function providerDisplayName(id: string): string {
  const map: Record<string, string> = {
    klikcollect: "KlikCollect",
    open_food_facts: "Open Food Facts",
    open_products_facts: "Open Products Facts",
  };
  return map[id] || id.replace(/_/g, " ");
}
