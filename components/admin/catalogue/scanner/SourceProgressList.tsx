"use client";

import { Loader2 } from "lucide-react";
import {
  providerDisplayName,
} from "@/lib/product-resolver/match-confidence";
import type { ProviderLookupResult } from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

const KNOWN = [
  "klikcollect",
  "open_food_facts",
  "open_products_facts",
] as const;

type Props = {
  loading?: boolean;
  providerResults?: ProviderLookupResult[];
  className?: string;
};

export default function SourceProgressList({
  loading,
  providerResults,
  className,
}: Props) {
  const byId = new Map((providerResults || []).map((p) => [p.provider, p]));
  const rows = KNOWN.map((id) => {
    const r = byId.get(id);
    let state: "pending" | "hit" | "miss" | "error" | "done" = "pending";
    if (r) {
      if (r.status === "hit") state = "hit";
      else if (r.status === "miss" || r.status === "skipped") state = "miss";
      else if (r.status === "error" || r.status === "timeout" || r.status === "rate_limited")
        state = "error";
      else state = "done";
    } else if (!loading) {
      state = "miss";
    }
    return { id, state, message: r?.message };
  });

  return (
    <ul className={cn("space-y-1.5", className)}>
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 text-[12px]"
        >
          <span className="text-black/55">{providerDisplayName(row.id)}</span>
          <span className="tabular-nums text-black/80">
            {row.state === "pending" ? (
              <Loader2 className="inline h-3.5 w-3.5 animate-spin text-black/35" />
            ) : row.state === "hit" ? (
              <span className="text-emerald-800">✓</span>
            ) : row.state === "error" ? (
              <span className="text-red-700">!</span>
            ) : (
              <span className="text-black/30">—</span>
            )}
          </span>
        </li>
      ))}
      {loading ? (
        <li className="pt-1 text-[11px] text-black/40">
          Looking across KlikCollect and product sources…
        </li>
      ) : null}
    </ul>
  );
}
