"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearSyncedOfflineScans,
  isBrowserOnline,
  listOfflineScans,
  syncOfflineScans,
  type OfflineScanItem,
} from "@/lib/catalogue/offline-scan-queue";
import { adminUi } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  onSynced?: () => void;
};

export default function OfflineScanQueuePanel({ className, onSynced }: Props) {
  const [items, setItems] = useState<OfflineScanItem[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listOfflineScans({ includeSynced: false });
      setItems(list);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const on = () => {
      setOnline(isBrowserOnline());
      if (isBrowserOnline()) void syncOfflineScans().then(() => refresh());
    };
    const off = () => setOnline(false);
    setOnline(isBrowserOnline());
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh]);

  const sync = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const result = await syncOfflineScans({ limit: 25 });
      setMsg(
        `Synced ${result.synced} · failed ${result.failed} · remaining ${result.remaining}`,
      );
      await refresh();
      onSynced?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  if (!items.length && online) {
    return null;
  }

  return (
    <div
      className={cn(
        "border border-amber-600/25 bg-amber-500/[0.08] px-4 py-3 text-[12px] text-amber-950",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          Offline queue · {items.length} pending
          {!online ? " · device offline" : ""}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !online || !items.length}
            onClick={() => void sync()}
            className={cn(adminUi.btnGhost, "text-amber-900 disabled:opacity-40")}
          >
            {busy ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void clearSyncedOfflineScans().then(() => refresh())
            }
            className={cn(adminUi.btnGhost, "text-amber-900/60")}
          >
            Clear synced
          </button>
        </div>
      </div>
      {msg ? <p className="mt-1 text-amber-900/80">{msg}</p> : null}
      <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto font-mono text-[11px]">
        {items.slice(0, 8).map((i) => (
          <li key={i.id}>
            {i.barcode} · {i.status}
            {i.lastError ? ` · ${i.lastError}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
