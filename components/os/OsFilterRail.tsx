"use client";

import { cn } from "@/lib/utils";

export type OsFilterOption = {
  id: string;
  label: string;
  count?: number;
};

/** Horizontal-scroll filter chips — avoids wrapping tab piles on mobile. */
export function OsFilterRail({
  options,
  value,
  onChange,
  className,
}: {
  options: OsFilterOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto border-b border-black/10 px-4 pb-3 sm:-mx-0 sm:px-0",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "shrink-0 px-3 py-2 text-[12px] font-medium uppercase tracking-[0.1em] transition-colors",
              active
                ? "bg-black text-white"
                : "border border-black/10 text-black/50 hover:border-black/30 hover:text-black",
            )}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span className="ml-1.5 tabular-nums opacity-70">{opt.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
