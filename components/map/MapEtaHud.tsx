"use client";

import { formatDistanceKm, formatDuration } from "@/lib/mapbox";
import { cn } from "@/lib/utils";
import { mapGlass } from "@/components/map/MapChrome";

type MapEtaHudProps = {
  distanceM?: number | null;
  durationS?: number | null;
  label?: string;
  className?: string;
};

/** Floating translucent ETA / distance chip. */
export default function MapEtaHud({
  distanceM,
  durationS,
  label = "ETA",
  className,
}: MapEtaHudProps) {
  if (distanceM == null && durationS == null) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 px-4 py-2.5",
        mapGlass,
        className,
      )}
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-black/40">
          {label}
        </p>
        <p className="text-[18px] font-medium tabular-nums leading-tight text-black">
          {durationS != null ? formatDuration(durationS) : "—"}
        </p>
      </div>
      {distanceM != null ? (
        <div className="border-l border-black/10 pl-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-black/40">
            Dist
          </p>
          <p className="text-[15px] font-medium tabular-nums leading-tight text-black/80">
            {formatDistanceKm(distanceM / 1000)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
