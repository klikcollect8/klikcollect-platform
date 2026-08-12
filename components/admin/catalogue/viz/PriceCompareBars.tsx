"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { adminUi } from "@/components/admin/admin-ui";
import {
  CHART_TICK,
  CHART_TOOLTIP,
  FILL_ACTIVE,
  FILL_MUTED,
} from "@/components/admin/catalogue/viz/chart-theme";
import { cn } from "@/lib/utils";

/** Mini comparison bars for catalogue slide-over (guide vs min offer). */
export default function PriceCompareBars({
  guide,
  minOffer,
  className,
  height = 120,
}: {
  guide?: number | null;
  minOffer?: number | null;
  className?: string;
  height?: number;
}) {
  const data = [
    guide != null && Number.isFinite(guide)
      ? { label: "Guide", value: Math.round(Number(guide) / 100), fill: FILL_ACTIVE }
      : null,
    minOffer != null && Number.isFinite(minOffer)
      ? {
          label: "Min offer",
          value: Math.round(Number(minOffer) / 100),
          fill: FILL_MUTED,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: number; fill: string }>;

  if (!data.length) return null;

  return (
    <section className={cn("min-w-0", className)}>
      <h3 className={cn("mb-3", adminUi.sectionLabel)}>Pricing (KES)</h3>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis
              dataKey="label"
              tick={CHART_TICK}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={CHART_TOOLTIP}
              formatter={(v) => [`KSh ${Number(v).toLocaleString()}`, ""]}
            />
            <Bar dataKey="value" radius={0}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
