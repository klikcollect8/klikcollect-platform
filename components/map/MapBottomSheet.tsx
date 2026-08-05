"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SheetSnap = "peek" | "half" | "full";

type MapBottomSheetProps = {
  children: ReactNode;
  className?: string;
  snap?: SheetSnap;
  onSnapChange?: (snap: SheetSnap) => void;
  peekHeight?: string;
  /** Remove content padding (e.g. full-bleed detail panels). */
  flush?: boolean;
};

const SNAP_CLASS: Record<SheetSnap, string> = {
  peek: "max-h-[28vh]",
  half: "max-h-[52vh]",
  full: "max-h-[82vh]",
};

/** Uber-style mobile bottom sheet with snap heights. */
export default function MapBottomSheet({
  children,
  className,
  snap: controlledSnap,
  onSnapChange,
  peekHeight,
  flush = false,
}: MapBottomSheetProps) {
  const [internal, setInternal] = useState<SheetSnap>("half");
  const snap = controlledSnap ?? internal;

  const cycle = () => {
    const order: SheetSnap[] = ["peek", "half", "full"];
    const next = order[(order.indexOf(snap) + 1) % order.length];
    if (onSnapChange) onSnapChange(next);
    else setInternal(next);
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-30",
        className,
      )}
    >
      <div className="pointer-events-none h-12 bg-gradient-to-t from-[#f7f7f5] via-[#f7f7f5]/80 to-transparent" />
      <div
        className={cn(
          "pointer-events-auto overflow-hidden rounded-t-[22px] bg-[#f7f7f5] shadow-[0_-12px_48px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.06] transition-[max-height] duration-300 ease-out",
          SNAP_CLASS[snap],
          "overflow-y-auto",
        )}
        style={snap === "peek" && peekHeight ? { maxHeight: peekHeight } : undefined}
      >
        <button
          type="button"
          onClick={cycle}
          className="sticky top-0 z-10 flex w-full justify-center bg-[#f7f7f5]/95 pb-1 pt-3 backdrop-blur"
          aria-label="Resize sheet"
        >
          <span className="h-1.5 w-12 rounded-full bg-black/12" />
        </button>
        <div
          className={
            flush
              ? "pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
              : "px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1 sm:px-5"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
