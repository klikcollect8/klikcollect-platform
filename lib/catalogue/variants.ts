export type OptionAxis = {
  name: string;
  values: string[];
};

export type VariantCombo = {
  title: string;
  options: Record<string, string>;
  key: string;
};

/** Cartesian product of option axes. */
export function generateVariantCombos(axes: OptionAxis[]): VariantCombo[] {
  const cleaned = axes
    .map((a) => ({
      name: String(a.name || "").trim(),
      values: [...new Set((a.values || []).map((v) => String(v).trim()).filter(Boolean))],
    }))
    .filter((a) => a.name && a.values.length);

  if (!cleaned.length) return [];

  let combos: Record<string, string>[] = [{}];
  for (const axis of cleaned) {
    const next: Record<string, string>[] = [];
    for (const prev of combos) {
      for (const value of axis.values) {
        next.push({ ...prev, [axis.name]: value });
      }
    }
    combos = next;
  }

  return combos.map((options) => {
    const title = Object.values(options).join(" / ");
    const key = Object.entries(options)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("|");
    return { title, options, key };
  });
}

export function estimateVariantCount(axes: OptionAxis[]): number {
  return generateVariantCombos(axes).length;
}
