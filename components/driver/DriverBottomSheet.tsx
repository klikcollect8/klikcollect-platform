"use client";

import type { ReactNode } from "react";
import { mapGlass } from "@/components/map/MapChrome";
import { cn } from "@/lib/utils";

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
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20",
        className,
      )}
    >
      <div className="pointer-events-none h-20 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
      <div
        className={cn(
          "pointer-events-auto mx-3 mb-[calc(4.75rem+env(safe-area-inset-bottom))] overflow-hidden sm:mx-4",
          mapGlass,
          expanded ? "max-h-[78vh]" : "max-h-[52vh]",
          "overflow-y-auto",
        )}
      >
        <div className="sticky top-0 z-10 flex justify-center bg-white/20 pt-3 pb-1 backdrop-blur-xl">
          <div className="h-1 w-10 bg-black/15" />
        </div>
        <div className="px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}
