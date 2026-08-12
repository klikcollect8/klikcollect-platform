/**
 * Client-side IndexedDB queue for offline barcode scans.
 * Syncs to /api/admin/catalogue/resolve when online.
 */

const DB_NAME = "kc-offline-scans";
const DB_VERSION = 1;
const STORE = "scans";

export type OfflineScanStatus =
  | "queued"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

export type OfflineScanItem = {
  id: string;
  barcode: string;
  formatHint?: string | null;
  discoveryId?: string | null;
  context?: string | null;
  createdAt: number;
  status: OfflineScanStatus;
  attempts: number;
  lastError?: string | null;
  syncedAt?: number | null;
  productId?: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IDB open failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IDB tx failed"));
    tx.onabort = () => reject(tx.error || new Error("IDB tx aborted"));
  });
}

export async function enqueueOfflineScan(input: {
  barcode: string;
  formatHint?: string | null;
  discoveryId?: string | null;
  context?: string | null;
}): Promise<OfflineScanItem> {
  const item: OfflineScanItem = {
    id: `ofs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    barcode: input.barcode.trim(),
    formatHint: input.formatHint || null,
    discoveryId: input.discoveryId || null,
    context: input.context || null,
    createdAt: Date.now(),
    status: "queued",
    attempts: 0,
  };
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(item);
  await txDone(tx);
  db.close();
  return item;
}

export async function listOfflineScans(
  opts?: { includeSynced?: boolean },
): Promise<OfflineScanItem[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const all = await new Promise<OfflineScanItem[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as OfflineScanItem[]) || []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  const filtered = opts?.includeSynced
    ? all
    : all.filter((i) => i.status !== "synced");
  return filtered.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateOfflineScan(
  id: string,
  patch: Partial<OfflineScanItem>,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const existing = await new Promise<OfflineScanItem | undefined>(
    (resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as OfflineScanItem | undefined);
      req.onerror = () => reject(req.error);
    },
  );
  if (existing) {
    store.put({ ...existing, ...patch, id });
  }
  await txDone(tx);
  db.close();
}

export async function removeOfflineScan(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}

export async function clearSyncedOfflineScans(): Promise<number> {
  const items = await listOfflineScans({ includeSynced: true });
  const synced = items.filter((i) => i.status === "synced");
  for (const item of synced) {
    await removeOfflineScan(item.id);
  }
  return synced.length;
}

export type SyncOfflineResult = {
  synced: number;
  failed: number;
  remaining: number;
  results: Array<{
    id: string;
    barcode: string;
    status: OfflineScanStatus;
    error?: string;
    productId?: string;
  }>;
};

/** Push queued scans through resolve API. */
export async function syncOfflineScans(opts?: {
  limit?: number;
}): Promise<SyncOfflineResult> {
  const limit = Math.min(40, Math.max(1, opts?.limit || 20));
  const pending = (await listOfflineScans()).filter(
    (i) => i.status === "queued" || i.status === "failed",
  );
  const batch = pending.slice(0, limit);
  const out: SyncOfflineResult = {
    synced: 0,
    failed: 0,
    remaining: 0,
    results: [],
  };

  for (const item of batch) {
    await updateOfflineScan(item.id, {
      status: "syncing",
      attempts: item.attempts + 1,
    });
    try {
      const res = await fetch("/api/admin/catalogue/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: item.barcode,
          formatHint: item.formatHint || undefined,
          discoveryId: item.discoveryId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: string }).error || `HTTP ${res.status}`;
        await updateOfflineScan(item.id, {
          status: "failed",
          lastError: err,
        });
        out.failed++;
        out.results.push({
          id: item.id,
          barcode: item.barcode,
          status: "failed",
          error: err,
        });
        continue;
      }
      const productId =
        (data as { localProduct?: { id?: string } }).localProduct?.id || null;
      await updateOfflineScan(item.id, {
        status: "synced",
        syncedAt: Date.now(),
        lastError: null,
        productId,
      });
      out.synced++;
      out.results.push({
        id: item.id,
        barcode: item.barcode,
        status: "synced",
        productId: productId || undefined,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Sync failed";
      await updateOfflineScan(item.id, { status: "failed", lastError: err });
      out.failed++;
      out.results.push({
        id: item.id,
        barcode: item.barcode,
        status: "failed",
        error: err,
      });
    }
  }

  out.remaining = (await listOfflineScans()).filter(
    (i) => i.status === "queued" || i.status === "failed",
  ).length;
  return out;
}

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}
