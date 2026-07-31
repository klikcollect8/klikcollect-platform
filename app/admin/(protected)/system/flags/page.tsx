'use client';

import { useCallback, useEffect, useState } from 'react';
import PageContainer from '@/components/admin/PageContainer';
import PageHeader from '@/components/admin/PageHeader';
import SectionCard from '@/components/admin/SectionCard';
import AccessControl from '@/components/admin/AccessControl';
import { useToast } from '@/components/ToastProvider';
import {
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
  type FeatureFlags,
} from '@/lib/feature-flag-types';

const LABELS: Record<FeatureFlagKey, string> = {
  pos: 'Point of sale',
  couriers: 'Couriers',
  marketing: 'Marketing',
  finance: 'Finance',
};

const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-[var(--kc-ink)] px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition-colors';

function FeatureFlagsContent() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system/flags');
      if (!res.ok) throw new Error('Failed');
      setFlags(await res.json());
    } catch {
      showToast('Could not load feature flags', 'error');
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
      const res = await fetch('/api/admin/system/flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flags),
      });
      if (!res.ok) throw new Error('Save failed');
      setFlags(await res.json());
      showToast('Feature flags saved', 'success');
    } catch {
      showToast('Could not save flags', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Feature flags"
        description="Toggle platform modules for staged rollouts."
        action={
          <button type="button" className={btnPrimary} disabled={saving || !flags} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        }
      />

      <SectionCard title="Module toggles">
        {loading || !flags ? (
          <p className="text-sm text-neutral-500">Loading flags…</p>
        ) : (
          <ul className="space-y-4">
            {FEATURE_FLAG_KEYS.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between gap-4 rounded-xl border border-neutral-100 bg-[var(--kc-canvas)] px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--kc-ink)]">{LABELS[key]}</p>
                  <p className="text-xs text-neutral-500 font-mono">{key}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flags[key]}
                  onClick={() => toggle(key)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    flags[key] ? 'bg-[var(--kc-ink)]' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      flags[key] ? 'left-[22px]' : 'left-0.5'
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
    <AccessControl allowedRoles={['head_admin', 'admin']}>
      <FeatureFlagsContent />
    </AccessControl>
  );
}
