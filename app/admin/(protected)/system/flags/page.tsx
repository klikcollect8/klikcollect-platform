"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import SectionCard from "@/components/admin/SectionCard";
import AccessControl from "@/components/admin/AccessControl";
import { useToast } from "@/components/ToastProvider";
import {
  FEATURE_FLAG_KEYS,
  FEATURE_FLAG_META,
  type FeatureFlagKey,
  type FeatureFlags,
} from "@/lib/feature-flag-types";
import { adminUi } from "@/components/admin/admin-ui";

function FeatureFlagsContent() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/system/flags");
      if (!res.ok) throw new Error("Failed");
      setFlags(await res.json());
    } catch {
      showToast("Could not load feature flags", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (key: FeatureFlagKey) => {
    if (!flags) return;
    setFlags({ ...flags, [key]: !flags[key] });
  };

  const save = async () => {
    if (!flags) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/system/flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flags),
      });
      if (!res.ok) throw new Error("Save failed");
      setFlags(await res.json());
      showToast("Feature flags saved", "success");
    } catch {
      showToast("Could not save flags", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Feature flags"
        description="Toggle platform modules, ops planes, and dashboard widgets. Same controls as the Control panel."
        action={
          <button
            type="button"
            className={adminUi.btnPrimary}
            disabled={saving || !flags}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        }
      />

      <SectionCard title="Module toggles">
        {loading || !flags ? (
          <p className="text-sm text-slate-500">Loading flags…</p>
        ) : (
          <ul className="space-y-3">
            {FEATURE_FLAG_KEYS.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {FEATURE_FLAG_META[key].label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {FEATURE_FLAG_META[key].description}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    {key} · #{FEATURE_FLAG_META[key].group}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flags[key]}
                  onClick={() => toggle(key)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    flags[key] ? "bg-[#2563EB]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      flags[key] ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}

export default function FeatureFlagsPage() {
  return (
    <AccessControl requiredPermission="flags:manage">
      <FeatureFlagsContent />
    </AccessControl>
  );
}
