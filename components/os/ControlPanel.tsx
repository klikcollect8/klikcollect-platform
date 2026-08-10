"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  LayoutGrid,
  Megaphone,
  Package,
  Repeat,
  ScanBarcode,
  Sparkles,
  Store,
  Truck,
  Users,
  Wallet,
  Warehouse,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_META,
  type FeatureFlagKey,
  type FeatureFlags,
} from "@/lib/feature-flag-types";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<FeatureFlagKey, LucideIcon>> = {
  pos: ScanBarcode,
  couriers: Truck,
  warehouse: Warehouse,
  store_ops: Store,
  marketing: Megaphone,
  finance: Wallet,
  analytics: BarChart3,
  branches: Store,
  customers: Users,
  widget_profit: LayoutGrid,
  widget_activity: BarChart3,
  widget_repeat: Repeat,
  widget_products: Package,
  widget_ai: Sparkles,
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged?: (flags: FeatureFlags) => void;
  /** os → /api/os/control-panel ; admin → /api/admin/system/flags */
  variant?: "os" | "admin";
  title?: string;
  subtitle?: string;
};

export function ControlPanel({
  open,
  onClose,
  onChanged,
  variant = "os",
  title = "Modules",
  subtitle = "Turn planes, modules, and dashboard widgets on when you need them.",
}: Props) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "modules" | "planes" | "widgets"
  >("all");

  const load = useCallback(async () => {
    try {
      if (variant === "admin") {
        const res = await fetch("/api/admin/system/flags");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setFlags(json as FeatureFlags);
        setCanEdit(true);
      } else {
        const res = await fetch("/api/os/control-panel");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Failed to load");
        setFlags(json.data);
        setCanEdit(!!json.canEdit);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [variant]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const keys = useMemo(() => {
    return FEATURE_FLAG_KEYS.filter((k) =>
      filter === "all" ? true : FEATURE_FLAG_META[k].group === filter,
    );
  }, [filter]);

  const enabledCount = useMemo(() => {
    if (!flags) return 0;
    return keys.filter((k) => flags[k]).length;
  }, [flags, keys]);

  const toggle = async (key: FeatureFlagKey) => {
    if (!flags || !canEdit) return;
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    setSaving(key);
    try {
      if (variant === "admin") {
        const res = await fetch("/api/admin/system/flags", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: next[key] }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Save failed");
        setFlags(json as FeatureFlags);
        onChanged?.(json as FeatureFlags);
      } else {
        const res = await fetch("/api/os/control-panel", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: next[key] }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message || "Save failed");
        setFlags(json.data);
        onChanged?.(json.data);
      }
    } catch (e) {
      setFlags(flags);
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close control panel"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[420px] flex-col border-l border-black/10 bg-[#f7f7f5]">
        <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
              Control panel
            </p>
            <h2
              className="mt-1 text-[22px] font-medium tracking-tight text-black"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {title}
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-black/45">
              {subtitle}
            </p>
            {flags ? (
              <p className="mt-2 text-[11px] tabular-nums text-black/35">
                {enabledCount} / {keys.length} on in this view
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-black/40 hover:text-black"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-black/10 px-3 py-2">
          {(
            [
              ["all", "All"],
              ["modules", "Modules"],
              ["planes", "Planes"],
              ["widgets", "Widgets"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "min-h-9 flex-1 px-2 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors",
                filter === id
                  ? "bg-black text-white"
                  : "text-black/45 hover:text-black",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-0 overflow-y-auto">
          {error ? (
            <p className="m-4 border border-red-900/15 bg-red-50 px-3 py-2 text-[13px] text-red-800">
              {error}
            </p>
          ) : null}
          {!flags ? (
            <p className="py-16 text-center text-[13px] text-black/35">
              Loading…
            </p>
          ) : (
            keys.map((key) => {
              const meta = FEATURE_FLAG_META[key];
              const Icon = ICONS[key] || LayoutGrid;
              const on = flags[key];
              return (
                <div
                  key={key}
                  className="flex items-start gap-3 border-b border-black/[0.06] px-5 py-4"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center",
                      on ? "bg-black text-white" : "bg-black/[0.04] text-black/35",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium tracking-tight text-black">
                          {meta.label}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-snug text-black/45">
                          {meta.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        disabled={!canEdit || saving === key}
                        onClick={() => void toggle(key)}
                        className={cn(
                          "relative mt-0.5 h-7 w-11 shrink-0 border transition-colors disabled:opacity-40",
                          on
                            ? "border-black bg-black"
                            : "border-black/20 bg-transparent",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 h-5 w-5 bg-white transition-transform",
                            on ? "left-[22px]" : "left-0.5",
                            on ? "" : "bg-black/25",
                          )}
                        />
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-black/30">
                      {meta.group}
                      {saving === key ? " · saving" : on ? " · on" : " · off"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          {flags && !canEdit ? (
            <p className="px-5 py-6 text-center text-[12px] text-black/40">
              You need permission to change these settings.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
