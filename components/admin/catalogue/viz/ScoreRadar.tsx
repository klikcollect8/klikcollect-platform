"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { adminUi } from "@/components/admin/admin-ui";
import {
  letterToScore,
  novaToScore,
} from "@/components/admin/catalogue/viz/aggregate";
import {
  CHART_TOOLTIP,
  FILL_ACTIVE,
} from "@/components/admin/catalogue/viz/chart-theme";
import { cn } from "@/lib/utils";

type Props = {
  nutriscore?: string | null;
  novaGroup?: number | string | null;
  ecoscore?: string | null;
  completeness?: number | null;
  className?: string;
  height?: number;
};

export default function ScoreRadar({
  nutriscore,
  novaGroup,
  ecoscore,
  completeness,
  className,
  height = 220,
}: Props) {
  const data = [
    { metric: "Nutri", value: letterToScore(nutriscore) },
    { metric: "NOVA", value: novaToScore(novaGroup) },
    { metric: "Eco", value: letterToScore(ecoscore) },
    {
      metric: "Complete",
      value:
        completeness != null && Number.isFinite(Number(completeness))
          ? Math.max(0, Math.min(100, Number(completeness)))
          : null,
    },
  ].map((d) => ({ ...d, value: d.value ?? 0, has: d.value != null }));

  const hasAny = data.some((d) => d.has);
  if (!hasAny) {
    return (
      <section className={cn("min-w-0", className)}>
        <h3 className={cn("mb-3", adminUi.sectionLabel)}>Scores</h3>
        <p className="py-10 text-[12px] text-black/35">No score data</p>
      </section>
    );
  }

  return (
    <section className={cn("min-w-0", className)}>
      <h3 className={cn("mb-3", adminUi.sectionLabel)}>Scores</h3>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="rgba(0,0,0,0.08)" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "rgba(0,0,0,0.45)", fontSize: 11 }}
            />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Radar
              name="Score"
              dataKey="value"
              stroke={FILL_ACTIVE}
              fill={FILL_ACTIVE}
              fillOpacity={0.12}
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
