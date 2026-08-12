"use client";

import { adminUi } from "@/components/admin/admin-ui";
import {
  buildSourceCompare,
  providerDisplayName,
} from "@/lib/product-resolver/match-confidence";
import type { ProviderLookupResult } from "@/lib/product-resolver/types";
import { cn } from "@/lib/utils";

type Props = {
  providerResults: ProviderLookupResult[];
  className?: string;
};

export default function SourceCompareMatrix({
  providerResults,
  className,
}: Props) {
  const rows = buildSourceCompare(providerResults);
  const providers = [
    ...new Set(
      rows.flatMap((r) => r.values.map((v) => v.provider)),
    ),
  ];

  if (!rows.length || providers.length < 1) {
    return (
      <p className={cn("text-[12px] text-black/40", className)}>
        No source fields to compare.
      </p>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <p className={cn("mb-3", adminUi.sectionLabel)}>Compare sources</p>
      <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-black/10">
            <th className="py-2 pr-2 font-medium text-black/40">Field</th>
            {providers.map((p) => (
              <th key={p} className="py-2 pr-2 font-medium text-black/40">
                {providerDisplayName(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-black/[0.05]">
              <td className="py-2 pr-2 text-black/50">{row.label}</td>
              {providers.map((p) => {
                const cell = row.values.find((v) => v.provider === p);
                const has = Boolean(cell?.value);
                return (
                  <td
                    key={p}
                    className={cn(
                      "max-w-[9rem] truncate py-2 pr-2",
                      cell?.conflict && has
                        ? "font-medium text-amber-900"
                        : has
                          ? "text-black"
                          : "text-black/25",
                    )}
                    title={cell?.value || undefined}
                  >
                    {has ? (row.key === "image" ? "✓" : cell?.value) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some((r) => r.values.some((v) => v.conflict)) ? (
        <p className="mt-2 text-[11px] text-amber-900">
          ⚠ Some fields disagree across sources — review before creating.
        </p>
      ) : null}
    </div>
  );
}
