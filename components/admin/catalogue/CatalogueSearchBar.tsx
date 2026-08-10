"use client";

import { forwardRef } from "react";
import { ListFilter, Search } from "lucide-react";
import ThemeSelect from "@/components/ui/ThemeSelect";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  activeFilterCount: number;
  statusOptions: Option[];
  sortOptions: Option[];
  className?: string;
};

const CatalogueSearchBar = forwardRef<HTMLInputElement, Props>(
  function CatalogueSearchBar(
    {
      query,
      onQueryChange,
      status,
      onStatusChange,
      sort,
      onSortChange,
      advancedOpen,
      onToggleAdvanced,
      activeFilterCount,
      statusOptions,
      sortOptions,
      className,
    },
    ref,
  ) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Mobile */}
        <div className="flex items-stretch gap-2 sm:hidden">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              ref={ref}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search name, SKU, barcode"
              className="box-border h-12 w-full border border-black/12 bg-transparent py-0 pl-10 pr-3 text-[16px] leading-none focus:border-black/40 focus:outline-none"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Filter by status"
              className={cn(
                "relative inline-flex h-12 w-12 shrink-0 items-center justify-center border border-black/12 text-black/55 transition-colors hover:border-black/30 hover:text-black",
                status ? "border-black/40 text-black" : "",
              )}
            >
              <ListFilter className="h-4 w-4" />
              {status || activeFilterCount > 0 ? (
                <span
                  className="absolute right-2.5 top-2.5 h-1.5 w-1.5 bg-black"
                  aria-hidden
                />
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuRadioGroup
                value={status || "all"}
                onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}
              >
                {statusOptions.map((o) => (
                  <DropdownMenuRadioItem key={o.value || "all"} value={o.value || "all"}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={onToggleAdvanced}
            aria-pressed={advancedOpen}
            className={cn(
              "inline-flex h-12 shrink-0 items-center border border-black/12 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-black/55",
              advancedOpen || activeFilterCount > 0
                ? "border-black/40 text-black"
                : "",
            )}
          >
            Filters
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        {/* Desktop */}
        <div className="mb-2 hidden items-stretch gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search name, SKU, barcode"
              className="box-border h-11 w-full border border-black/12 bg-transparent py-0 pl-11 pr-4 text-[14px] leading-none focus:border-black/40 focus:outline-none"
            />
          </div>
          <ThemeSelect
            value={status || "all"}
            onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}
            size="sm"
            fullWidth
            placeholder="Status"
            triggerClassName="box-border h-11 w-full min-w-0 px-4 text-[14px] leading-none"
            options={statusOptions.map((o) => ({
              value: o.value || "all",
              label: o.label,
            }))}
          />
          <ThemeSelect
            value={sort}
            onValueChange={onSortChange}
            size="sm"
            fullWidth
            placeholder="Sort"
            triggerClassName="box-border h-11 w-full min-w-0 px-4 text-[14px] leading-none"
            options={sortOptions}
          />
          <button
            type="button"
            onClick={onToggleAdvanced}
            aria-pressed={advancedOpen}
            className={cn(
              "inline-flex h-11 items-center justify-center border border-black/12 px-4 text-[11px] font-medium uppercase tracking-[0.14em] text-black/55 transition-colors hover:border-black/30 hover:text-black",
              advancedOpen || activeFilterCount > 0
                ? "border-black/40 text-black"
                : "",
            )}
          >
            Advanced
            {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </button>
        </div>
      </div>
    );
  },
);

export default CatalogueSearchBar;
