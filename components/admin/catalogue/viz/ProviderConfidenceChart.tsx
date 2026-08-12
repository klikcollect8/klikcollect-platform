"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminUi } from "@/components/admin/admin-ui";
import type { ProviderLookupResult } from "@/lib/product-resolver/types";
import {
  CHART_TICK,
  CHART_TOOLTIP,
  FILL_ACTIVE,
  FILL_MID,
  FILL_MUTED,
} from "@/components/admin/catalogue/viz/chart-theme";
import { cn } from "@/lib/utils";

type Props = {
  providerResults?: ProviderLookupResult[];
  className?: string;
  height?: number;
};

function statusScores(status: string) {
  const s = status.toLowerCase();
  if (s === "hit") return { found: 1, missing: 0, error: 0 };
  if (s === "miss" || s === "skipped") return { found: 0, missing: 1, error: 0 };
  if (s === "error" || s === "timeout" || s === "rate_limited") {
    return { found: 0, missing: 0, error: 1 };
  }
  return { found: 0, missing: 1, error: 0 };
}

export default function ProviderConfidenceChart({
  providerResults,
  className,
  height = 200,
}: Props) {
  const data = (providerResults || []).map((p) => {
    const scores = statusScores(p.status);
    return {
      provider: String(p.provider || "unknown").replace(/_/g, " "),
      found: scores.found,
      missing: scores.missing,
      error: scores.error,
      status: p.status,
    };
  });

  if (!data.length) {
    return (
      <section className={cn("min-w-0", className)}>
        <h3 className={cn("mb-3", adminUi.sectionLabel)}>Providers</h3>
        <p className="py-10 text-[12px] text-black/35">No provider results</p>
      </section>
    );
  }

  return (
    <section className={cn("min-w-0", className)}>
      <h3 className={cn("mb-3", adminUi.sectionLabel)}>Providers</h3>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,0,0,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="provider"
              tick={CHART_TICK}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={[0, 1]} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={CHART_TOOLTIP}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "rgba(0,0,0,0.45)" }}
            />
            <Bar dataKey="found" stackId="a" fill={FILL_ACTIVE} radius={0} />
            <Bar dataKey="missing" stackId="a" fill={FILL_MUTED} radius={0} />
            <Bar dataKey="error" stackId="a" fill={FILL_MID} radius={0} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
