"use client";

import { useCallback, useEffect, useState } from "react";
import AccessControl from "@/components/admin/AccessControl";
import PageContainer, {
  AdminPageHeader,
} from "@/components/admin/PageContainer";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type SourceRow = {
  providerId: string;
  displayName: string;
  enabled: boolean;
  isLocal: boolean;
  priority: number;
  healthStatus: string;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};

export default function SourcesAdminPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <SourcesInner />
    </AccessControl>
  );
}

function SourcesInner() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogue/sources");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load sources");
        return;
      }
      setSources(data.sources || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (row: SourceRow) => {
    if (row.isLocal) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalogue/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: row.providerId,
          enabled: !row.enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const probe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/catalogue/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Probe failed");
        return;
      }
      setSources(data.sources || []);
      const ok = (data.health || []).filter(
        (h: { ok: boolean }) => h.ok,
      ).length;
      setMsg(`Health probe complete · ${ok} healthy`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <AdminPageHeader
        title="Product sources"
        description="Enable or disable external adapters. KlikCollect remains canonical; external DBs are enrichment only."
        actions={
          <button
            type="button"
            disabled={busy}
            onClick={() => void probe()}
            className={adminUi.btnPrimary}
          >
            {busy ? "Working…" : "Run health probe"}
          </button>
        }
      />

      {error ? (
        <p className="mb-3 text-[13px] text-red-700">{error}</p>
      ) : null}
      {msg ? (
        <p className="mb-3 text-[13px] text-emerald-800">{msg}</p>
      ) : null}

      <div className="border border-black/10 bg-white">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-black/10 text-[11px] uppercase tracking-wide text-black/40">
            <tr>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Health</th>
              <th className="px-4 py-2">Last OK</th>
              <th className="px-4 py-2">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {sources.map((s) => (
              <tr key={s.providerId}>
                <td className="px-4 py-3">
                  <p className="font-medium">{s.displayName}</p>
                  <p className="text-[11px] text-black/40">
                    {s.providerId}
                    {s.isLocal ? " · local" : ""}
                  </p>
                  {s.lastError ? (
                    <p className="mt-1 text-[11px] text-red-700">
                      {s.lastError}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums">{s.priority}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-wide",
                      s.healthStatus === "healthy" && "text-emerald-700",
                      s.healthStatus === "degraded" && "text-amber-700",
                      s.healthStatus === "down" && "text-red-700",
                      s.healthStatus === "disabled" && "text-black/35",
                    )}
                  >
                    {s.healthStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px] text-black/45">
                  {s.lastOkAt
                    ? new Date(s.lastOkAt).toLocaleString("en-KE")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={busy || s.isLocal}
                    onClick={() => void toggle(s)}
                    className={cn(
                      "px-3 py-1 text-[11px] uppercase tracking-wide",
                      s.enabled
                        ? "bg-black text-white"
                        : "border border-black/15 text-black/50",
                      s.isLocal && "opacity-40",
                    )}
                  >
                    {s.enabled ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !sources.length ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-black/40"
                >
                  No sources registered — apply migration 037
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
