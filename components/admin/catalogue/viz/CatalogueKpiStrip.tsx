"use client";

import StatCard from "@/components/admin/StatCard";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type KpiItem = {
  label: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  active?: boolean;
};

type Props = {
  items: KpiItem[];
  className?: string;
};

export default function CatalogueKpiStrip({ items, className }: Props) {
  if (!items.length) return null;
  return (
    <div
      className={cn(
        "grid gap-6 border-b border-black/10 pb-6 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => {
        if (item.onClick) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={cn(
                "text-left transition-opacity hover:opacity-70",
                item.active && "ring-1 ring-black/15",
              )}
            >
              <StatCard
                label={item.label}
                value={item.value}
                description={item.description}
                icon={item.icon}
              />
            </button>
          );
        }
        return (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            description={item.description}
            icon={item.icon}
          />
        );
      })}
    </div>
  );
}
