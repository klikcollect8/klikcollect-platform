/**
 * Rule-based fee engine — commission % + delivery by area/hub.
 * MVP defaults: 10% commission, pickup delivery = 0.
 */
import { getServiceSupabase } from "@/lib/supabase/admin";

export type FeeLineInput = {
  productPublicId?: string;
  categoryName?: string;
  vendorPublicId: string;
  goodsMinor: number;
};

export type FeeQuoteInput = {
  lines: FeeLineInput[];
  areaKey?: string | null;
  collectHub?: string | null;
  fulfilment?: "pickup" | "delivery";
};

export type VendorFeeBreakdown = {
  vendorPublicId: string;
  goodsMinor: number;
  commissionMinor: number;
  deliveryMinor: number;
  netMinor: number;
};

export type FeeQuote = {
  goodsMinor: number;
  commissionMinor: number;
  deliveryMinor: number;
  customerTotalMinor: number;
  byVendor: VendorFeeBreakdown[];
  rulesApplied: string[];
};

type FeeRuleRow = {
  public_id: string;
  kind: "commission" | "delivery";
  category_name: string | null;
  product_public_id: string | null;
  vendor_public_id: string | null;
  area_key: string | null;
  collect_hub: string | null;
  percent_bps: number | null;
  flat_minor: number | null;
  priority: number;
};

const DEFAULT_COMMISSION_BPS = 1000; // 10%
const DEFAULT_DELIVERY_MINOR = 0;

function matchScore(
  rule: FeeRuleRow,
  ctx: {
    productPublicId?: string;
    categoryName?: string;
    vendorPublicId: string;
    areaKey?: string | null;
    collectHub?: string | null;
  },
): number | null {
  // Higher = more specific. Null = no match.
  let score = 0;
  if (rule.product_public_id) {
    if (rule.product_public_id !== ctx.productPublicId) return null;
    score += 1000;
  }
  if (rule.category_name) {
    if (
      (rule.category_name || "").toLowerCase() !==
      (ctx.categoryName || "").toLowerCase()
    )
      return null;
    score += 500;
  }
  if (rule.vendor_public_id) {
    if (rule.vendor_public_id !== ctx.vendorPublicId) return null;
    score += 200;
  }
  if (rule.area_key) {
    if ((rule.area_key || "").toLowerCase() !== (ctx.areaKey || "").toLowerCase())
      return null;
    score += 300;
  }
  if (rule.collect_hub) {
    if (
      (rule.collect_hub || "").toLowerCase() !==
      (ctx.collectHub || "").toLowerCase()
    )
      return null;
    score += 250;
  }
  // Prefer lower priority number as tie-breaker via negative
  score += Math.max(0, 10000 - (rule.priority || 100));
  return score;
}

function pickRule(
  rules: FeeRuleRow[],
  kind: FeeRuleRow["kind"],
  ctx: Parameters<typeof matchScore>[1],
): FeeRuleRow | null {
  let best: FeeRuleRow | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    if (rule.kind !== kind) continue;
    const score = matchScore(rule, ctx);
    if (score == null) continue;
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best;
}

export async function quoteFees(input: FeeQuoteInput): Promise<FeeQuote> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("fee_rules")
    .select("*")
    .eq("active", true)
    .order("priority", { ascending: true });

  const rules = (data || []) as FeeRuleRow[];
  const areaKey =
    input.areaKey ||
    (input.fulfilment === "pickup" || !input.fulfilment ? "pickup" : null);
  const collectHub = input.collectHub || null;
  const rulesApplied: string[] = [];

  const byVendorMap = new Map<string, VendorFeeBreakdown>();

  for (const line of input.lines) {
    const goods = Math.max(0, Math.round(line.goodsMinor));
    const ctx = {
      productPublicId: line.productPublicId,
      categoryName: line.categoryName,
      vendorPublicId: line.vendorPublicId,
      areaKey,
      collectHub,
    };
    const commissionRule = pickRule(rules, "commission", ctx);
    const bps = commissionRule?.percent_bps ?? DEFAULT_COMMISSION_BPS;
    if (commissionRule) rulesApplied.push(commissionRule.public_id);
    const commissionMinor = Math.round((goods * bps) / 10000);

    const existing = byVendorMap.get(line.vendorPublicId) || {
      vendorPublicId: line.vendorPublicId,
      goodsMinor: 0,
      commissionMinor: 0,
      deliveryMinor: 0,
      netMinor: 0,
    };
    existing.goodsMinor += goods;
    existing.commissionMinor += commissionMinor;
    byVendorMap.set(line.vendorPublicId, existing);
  }

  // Delivery charged once per quote (platform-kept in MVP).
  const deliveryRule = pickRule(rules, "delivery", {
    vendorPublicId: input.lines[0]?.vendorPublicId || "platform",
    areaKey,
    collectHub,
  });
  const deliveryMinor = Math.max(
    0,
    Math.round(deliveryRule?.flat_minor ?? DEFAULT_DELIVERY_MINOR),
  );
  if (deliveryRule) rulesApplied.push(deliveryRule.public_id);

  const byVendor = [...byVendorMap.values()].map((v) => ({
    ...v,
    netMinor: Math.max(0, v.goodsMinor - v.commissionMinor),
  }));

  const goodsMinor = byVendor.reduce((s, v) => s + v.goodsMinor, 0);
  const commissionMinor = byVendor.reduce((s, v) => s + v.commissionMinor, 0);

  return {
    goodsMinor,
    commissionMinor,
    deliveryMinor,
    customerTotalMinor: goodsMinor + deliveryMinor,
    byVendor,
    rulesApplied: [...new Set(rulesApplied)],
  };
}
