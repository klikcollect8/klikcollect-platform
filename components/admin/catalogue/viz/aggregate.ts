export type CountBucket = { key: string; label: string; value: number };

function bump(
  map: Map<string, number>,
  key: string,
  amount = 1,
) {
  map.set(key, (map.get(key) || 0) + amount);
}

export function countByKey(
  items: Array<Record<string, unknown>>,
  getKey: (item: Record<string, unknown>) => string | null | undefined,
  labelFn?: (key: string) => string,
): CountBucket[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const raw = getKey(item);
    const key = (raw || "unknown").toString().trim() || "unknown";
    bump(map, key);
  }
  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      label: labelFn ? labelFn(key) : key,
      value,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function completenessBuckets(
  scores: Array<number | null | undefined>,
): CountBucket[] {
  const bands = [
    { key: "0-25", label: "0–25", min: 0, max: 25 },
    { key: "25-50", label: "25–50", min: 25, max: 50 },
    { key: "50-75", label: "50–75", min: 50, max: 75 },
    { key: "75-100", label: "75–100", min: 75, max: 101 },
  ];
  const counts = bands.map((b) => ({ ...b, value: 0 }));
  for (const s of scores) {
    if (s == null || !Number.isFinite(s)) continue;
    const band = counts.find((b) => s >= b.min && s < b.max);
    if (band) band.value += 1;
  }
  return counts.map(({ key, label, value }) => ({ key, label, value }));
}

export function nutriscoreBuckets(
  letters: Array<string | null | undefined>,
): CountBucket[] {
  const order = ["a", "b", "c", "d", "e", "unknown"];
  const map = new Map<string, number>();
  for (const l of letters) {
    const key = l?.toString().trim().toLowerCase().charAt(0);
    if (key && order.includes(key)) bump(map, key);
    else bump(map, "unknown");
  }
  return order
    .filter((k) => (map.get(k) || 0) > 0 || k !== "unknown")
    .map((key) => ({
      key,
      label: key === "unknown" ? "—" : key.toUpperCase(),
      value: map.get(key) || 0,
    }))
    .filter((b) => b.value > 0 || b.key !== "unknown");
}

export function stockBands(
  stocks: Array<number | null | undefined>,
): CountBucket[] {
  const bands = [
    { key: "0", label: "0", test: (n: number) => n <= 0 },
    { key: "1-10", label: "1–10", test: (n: number) => n >= 1 && n <= 10 },
    { key: "10+", label: "10+", test: (n: number) => n > 10 },
  ];
  const out = bands.map((b) => ({ key: b.key, label: b.label, value: 0 }));
  for (const s of stocks) {
    if (s == null || !Number.isFinite(s)) {
      out[0].value += 1;
      continue;
    }
    const idx = bands.findIndex((b) => b.test(Number(s)));
    if (idx >= 0) out[idx].value += 1;
  }
  return out;
}

export function offersSplit(
  offerCounts: Array<number | null | undefined>,
): CountBucket[] {
  let withOffers = 0;
  let without = 0;
  for (const n of offerCounts) {
    if (n != null && Number(n) > 0) withOffers += 1;
    else without += 1;
  }
  return [
    { key: "has", label: "Has offers", value: withOffers },
    { key: "none", label: "No offers", value: without },
  ].filter((b) => b.value > 0);
}

/** Map NutriScore / EcoScore letter to 0–100 for radar. */
export function letterToScore(letter: string | null | undefined): number | null {
  if (!letter) return null;
  const c = letter.toString().trim().toLowerCase().charAt(0);
  const order = ["a", "b", "c", "d", "e"];
  const idx = order.indexOf(c);
  if (idx < 0) return null;
  return Math.round(((order.length - idx) / order.length) * 100);
}

export function novaToScore(nova: number | string | null | undefined): number | null {
  if (nova == null || nova === "") return null;
  const n = Number(nova);
  if (!Number.isFinite(n) || n < 1 || n > 4) return null;
  return Math.round(((5 - n) / 4) * 100);
}

export function nutritionChartRows(
  nutrition: Record<string, unknown> | null | undefined,
  limit = 10,
): Array<{ key: string; label: string; value: number }> {
  if (!nutrition) return [];
  const rows: Array<{ key: string; label: string; value: number }> = [];
  for (const [k, v] of Object.entries(nutrition)) {
    if (v == null) continue;
    let num: number | null = null;
    if (typeof v === "number" && Number.isFinite(v)) num = v;
    else if (typeof v === "string") {
      const parsed = parseFloat(v.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) num = parsed;
    } else if (typeof v === "object" && v !== null && "value" in v) {
      const nested = Number((v as { value?: unknown }).value);
      if (Number.isFinite(nested)) num = nested;
    }
    if (num == null) continue;
    rows.push({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: num,
    });
  }
  return rows
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit);
}
