"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Activity, CheckCircle2, Package, ShoppingBag } from "lucide-react";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import SectionCard from "@/components/admin/SectionCard";
import StatCard from "@/components/admin/StatCard";
import AccessControl from "@/components/admin/AccessControl";
import { useToast } from "@/components/ToastProvider";

type HealthPayload = {
  ok: boolean;
  catalogueCount: number;
  ordersCount: number;
  timestamp: string;
};

function SystemHealthContent() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/system/health");
      if (!res.ok) throw new Error("Health check failed");
      setHealth(await res.json());
    } catch {
      showToast("Could not load system health", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        title="System health"
        description="Live snapshot of catalogue and order stores."
      />

      {loading && !health ? (
        <p className="text-sm text-neutral-500">Running health check…</p>
      ) : health ? (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Status"
              value={health.ok ? "OK" : "Degraded"}
              icon={health.ok ? CheckCircle2 : Activity}
              description={health.ok ? "All checks passed" : "Review services"}
            />
            <StatCard
              label="Catalogue items"
              value={String(health.catalogueCount)}
              icon={Package}
            />
            <StatCard
              label="Orders"
              value={String(health.ordersCount)}
              icon={ShoppingBag}
            />
            <StatCard
              label="Last check"
              value={format(new Date(health.timestamp), "HH:mm:ss")}
              icon={Activity}
              description={format(new Date(health.timestamp), "PP")}
            />
          </div>

          <SectionCard title="Health payload">
            <pre className="overflow-x-auto rounded-lg bg-[var(--kc-canvas)] p-4 text-xs text-[var(--kc-ink)]">
              {JSON.stringify(health, null, 2)}
            </pre>
          </SectionCard>
        </>
      ) : null}
    </PageContainer>
  );
}

export default function SystemHealthPage() {
  return (
    <AccessControl requiredPermission="system:health">
      <SystemHealthContent />
    </AccessControl>
  );
}
