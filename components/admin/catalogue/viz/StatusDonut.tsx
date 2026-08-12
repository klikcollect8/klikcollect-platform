"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { adminUi } from "@/components/admin/admin-ui";
import type { CountBucket } from "@/components/admin/catalogue/viz/aggregate";
import {
  CHART_TOOLTIP,
  DONUT_PALETTE,
} from "@/components/admin/catalogue/viz/chart-theme";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  data: CountBucket[];
  activeKey?: string | null;
  onSelect?: (key: string) => void;
  className?: string;
  height?: number;
};

export default function StatusDonut({
  title,
  data,
  activeKey,
  onSelect,
  className,
  height = 200,
}: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total === 0) {
    return (
      <section className={cn("min-w-0", className)}>
        <h3 className={cn("mb-3", adminUi.sectionLabel)}>{title}</h3>
        <p className="py-10 text-[12px] text-black/35">No data</p>
      </section>
    );
  }

  return (
    <section className={cn("min-w-0", className)}>
      <h3 className={cn("mb-3", adminUi.sectionLabel)}>{title}</h3>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={1}
              cursor={onSelect ? "pointer" : "default"}
              onClick={(entry) => {
                const key = (entry as { key?: string })?.key;
                if (key && onSelect) onSelect(key);
              }}
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.key}
                  fill={DONUT_PALETTE[i % DONUT_PALETTE.length]}
                  opacity={
                    activeKey && activeKey !== entry.key ? 0.35 : 1
                  }
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_TOOLTIP} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1">
        {data.map((d, i) => (
          <li key={d.key}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(d.key)}
              className={cn(
                "flex w-full items-center justify-between gap-2 text-[11px] text-black/55",
                onSelect && "hover:text-black",
                activeKey === d.key && "font-medium text-black",
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  className="inline-block h-2 w-2 shrink-0"
                  style={{
                    background: DONUT_PALETTE[i % DONUT_PALETTE.length],
                  }}
                />
                {d.label}
              </span>
              <span className="tabular-nums">{d.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
