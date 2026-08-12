"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminUi } from "@/components/admin/admin-ui";
import { nutritionChartRows } from "@/components/admin/catalogue/viz/aggregate";
import {
  CHART_TICK,
  CHART_TOOLTIP,
  FILL_ACTIVE,
} from "@/components/admin/catalogue/viz/chart-theme";
import { cn } from "@/lib/utils";

type Props = {
  nutrition?: Record<string, unknown> | null;
  className?: string;
  height?: number;
  limit?: number;
};

export default function NutritionBars({
  nutrition,
  className,
  height = 240,
  limit = 10,
}: Props) {
  const data = nutritionChartRows(nutrition, limit);
  if (!data.length) {
    return (
      <section className={cn("min-w-0", className)}>
        <h3 className={cn("mb-3", adminUi.sectionLabel)}>Nutrition</h3>
        <p className="py-10 text-[12px] text-black/35">No nutrition data</p>
      </section>
    );
  }

  return (
    <section className={cn("min-w-0", className)}>
      <h3 className={cn("mb-3", adminUi.sectionLabel)}>Nutrition</h3>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={100}
              tick={CHART_TICK}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={CHART_TOOLTIP}
            />
            <Bar dataKey="value" fill={FILL_ACTIVE} radius={0} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
