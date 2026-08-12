"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminUi } from "@/components/admin/admin-ui";
import type { CountBucket } from "@/components/admin/catalogue/viz/aggregate";
import {
  CHART_TICK,
  CHART_TOOLTIP,
  FILL_ACTIVE,
  FILL_MUTED,
} from "@/components/admin/catalogue/viz/chart-theme";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  data: CountBucket[];
  activeKey?: string | null;
  onSelect?: (key: string) => void;
  className?: string;
  height?: number;
  layout?: "vertical" | "horizontal";
};

export default function DistributionBar({
  title,
  data,
  activeKey,
  onSelect,
  className,
  height = 200,
  layout = "horizontal",
}: Props) {
  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <section className={cn("min-w-0", className)}>
        <h3 className={cn("mb-3", adminUi.sectionLabel)}>{title}</h3>
        <p className="py-10 text-[12px] text-black/35">No data</p>
      </section>
    );
  }

  const vertical = layout === "vertical";

  return (
    <section className={cn("min-w-0", className)}>
      <h3 className={cn("mb-3", adminUi.sectionLabel)}>{title}</h3>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={vertical ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 8, left: vertical ? 8 : 0, bottom: 0 }}
          >
            {vertical ? (
              <>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={72}
                  tick={CHART_TICK}
                  axisLine={false}
                  tickLine={false}
                />
              </>
            ) : (
              <XAxis
                dataKey="label"
                tick={CHART_TICK}
                axisLine={false}
                tickLine={false}
              />
            )}
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={CHART_TOOLTIP}
            />
            <Bar
              dataKey="value"
              radius={0}
              cursor={onSelect ? "pointer" : "default"}
              onClick={(entry) => {
                const key = (entry as { key?: string })?.key;
                if (key && onSelect) onSelect(key);
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    activeKey && activeKey === entry.key
                      ? FILL_ACTIVE
                      : activeKey
                        ? FILL_MUTED
                        : FILL_ACTIVE
                  }
                  opacity={
                    !activeKey || activeKey === entry.key ? 1 : 0.45
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
