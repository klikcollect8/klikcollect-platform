"use client";

import {
  confidenceLabel,
  type LocationConfidence,
} from "@/lib/location/types";
import { cn } from "@/lib/utils";

const TONE: Record<LocationConfidence, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  gps_verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  user_pinned: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  provider_resolved: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-red-50 text-red-700 border-red-200",
  manual: "bg-black/5 text-black/60 border-black/10",
};

export default function LocationConfidenceBadge({
  confidence,
  className,
}: {
  confidence: LocationConfidence | null | undefined;
  className?: string;
}) {
  if (!confidence) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE[confidence],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          confidence === "high" ||
            confidence === "gps_verified" ||
            confidence === "user_pinned"
            ? "bg-emerald-500"
            : confidence === "low"
              ? "bg-red-500"
              : confidence === "manual"
                ? "bg-black/40"
                : "bg-amber-500",
        )}
      />
      {confidenceLabel(confidence)}
    </span>
  );
}
