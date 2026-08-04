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
  title = "Enable modules",
  subtitle = "Turn planes, modules, and dashboard widgets on when you need them.",
}: Props) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "modules" | "planes" | "widgets"
  >("all");

  const accent = variant === "admin" ? "#2563EB" : "#3B82F6";

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
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[3px]"
        aria-label="Close control panel"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[440px] flex-col bg-white shadow-[-24px_0_64px_rgba(15,23,42,0.14)]">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: accent }}
            >
              Control panel
            </p>
            <h2 className="mt-1 text-[20px] font-bold text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-slate-100 px-5 py-3">
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
                "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                filter === id
                  ? "text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
              style={filter === id ? { background: accent } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
              {error}
            </p>
          ) : null}
          {!flags ? (
            <p className="py-10 text-center text-[13px] text-slate-400">
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
                  className={cn(
                    "rounded-2xl border p-4 transition",
                    on ? "bg-blue-50/80" : "border-slate-200 bg-white",
                  )}
                  style={on ? { borderColor: `${accent}55` } : undefined}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                        on ? "text-white" : "bg-slate-100 text-slate-500",
                      )}
                      style={on ? { background: accent } : undefined}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-slate-900">
                        {meta.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {meta.description}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-slate-400">
                        #{meta.group}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={cn(
                            "text-[11px] font-bold uppercase tracking-wide",
                            on ? "text-emerald-600" : "text-slate-400",
                          )}
                        >
                          {on ? "Enabled" : "Disabled"}
                        </span>
                        <button
                          type="button"
                          disabled={!canEdit || saving === key}
                          onClick={() => void toggle(key)}
                          className={cn(
                            "min-w-[88px] rounded-xl px-3 py-2 text-[12px] font-semibold transition disabled:opacity-40",
                            on
                              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              : "text-white",
                          )}
                          style={!on ? { background: accent } : undefined}
                        >
                          {saving === key ? "…" : on ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {flags && !canEdit ? (
            <p className="pb-4 text-center text-[12px] text-slate-400">
              You need permission to change these settings.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
