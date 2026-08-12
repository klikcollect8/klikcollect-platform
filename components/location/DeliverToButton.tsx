"use client";

/**
 * DeliverToButton — compact header chip ("Deliver to ▾ Westlands, Nairobi")
 * that opens the LocationPicker and stores the selection in the market-wide
 * ActiveLocationContext.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, MapPin } from "lucide-react";
import { useActiveLocation } from "@/components/providers/ActiveLocationProvider";
import type { LocationPickerResult } from "@/components/location/LocationPicker";
import { cn } from "@/lib/utils";

const LocationPicker = dynamic(
  () => import("@/components/location/LocationPicker"),
  { ssr: false },
);

export default function DeliverToButton({
  className,
}: {
  className?: string;
}) {
  const { active, setActive } = useActiveLocation();
  const [open, setOpen] = useState(false);

  const handleConfirm = (r: LocationPickerResult) => {
    setOpen(false);
    setActive({
      lat: r.lat,
      lng: r.lng,
      label:
        r.formattedAddress
          ?.split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(", ") || "Selected location",
      formattedAddress: r.formattedAddress,
      building: r.building,
      landmark: r.landmark,
      instructions: r.instructions,
      placeId: r.placeId ?? null,
      source: r.source,
      confidence: r.confidence,
      savedLocationId: r.savedLocationId ?? null,
      setAt: Date.now(),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          active ? `Deliver to ${active.label}` : "Set delivery location"
        }
        className={cn(
          "inline-flex min-h-9 max-w-[220px] items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] text-black/70 transition-colors hover:border-black/25 hover:text-black",
          className,
        )}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="flex min-w-0 flex-col text-left leading-tight">
          <span className="text-[10px] uppercase tracking-[0.12em] text-black/35">
            Deliver to
          </span>
          <span className="truncate font-medium">
            {active?.label || "Set location"}
          </span>
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-black/35" />
      </button>

      <LocationPicker
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        context="saved_location"
        title="Where should we deliver?"
        confirmLabel="Use this location"
        collectDetails={false}
        initial={
          active
            ? {
                lat: active.lat,
                lng: active.lng,
                formattedAddress: active.formattedAddress,
                building: active.building,
                landmark: active.landmark,
                instructions: active.instructions,
              }
            : null
        }
      />
    </>
  );
}
