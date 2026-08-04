"use client";

import type { ReactNode } from "react";

type DriverBottomSheetProps = {
  children: ReactNode;
  className?: string;
  expanded?: boolean;
};

export default function DriverBottomSheet({
  children,
  className = "",
  expanded,
}: DriverBottomSheetProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 ${className}`}
    >
      <div className="pointer-events-none h-16 bg-gradient-to-t from-white via-white/80 to-transparent" />
      <div
        className={`pointer-events-auto mx-0 overflow-hidden rounded-t-[28px] bg-white shadow-[0_-12px_48px_rgba(0,0,0,0.14)] ring-1 ring-black/[0.04] ${
          expanded ? "max-h-[80vh]" : "max-h-[54vh]"
        } overflow-y-auto`}
      >
        <div className="sticky top-0 z-10 flex justify-center bg-white/95 pt-3 pb-1 backdrop-blur">
          <div className="h-1.5 w-12 rounded-full bg-black/12" />
        </div>
        <div className="px-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
