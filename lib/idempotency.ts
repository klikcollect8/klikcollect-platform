/**
 * INV-5 state-mutating idempotency.
 * On serverless (Vercel), use an in-memory Map — never local FS (ephemeral + races).
 * Locally, optional JSON cache for dev convenience.
 */
import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR, ensureDataDir, isServerlessRuntime } from "@/lib/data-dir";

const FILE = "idempotency.json";
const MEMORY_TTL_MS = 15 * 60 * 1000;
const MEMORY_MAX = 2000;

type IdemRecord = {
  key: string;
  route: string;
  status: number;
  body: unknown;
  createdAt: string;
};

type MemoryEntry = IdemRecord & { expiresAt: number };

const memory = new Map<string, MemoryEntry>();

function memKey(route: string, key: string) {
  return `${route}::${key}`;
}

function pruneMemory() {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAt <= now) memory.delete(k);
  }
  if (memory.size <= MEMORY_MAX) return;
  const oldest = [...memory.entries()]
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    .slice(0, memory.size - MEMORY_MAX);
  for (const [k] of oldest) memory.delete(k);
}

async function readAll(): Promise<IdemRecord[]> {
  if (isServerlessRuntime()) return [];
  try {
    await ensureDataDir();
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const data = JSON.parse(raw) as IdemRecord[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: IdemRecord[]) {
  if (isServerlessRuntime()) return;
  const ok = await ensureDataDir();
  if (!ok) return;
  try {
    const trimmed = rows.slice(-500);
    await fs.writeFile(
      path.join(DATA_DIR, FILE),
      JSON.stringify(trimmed, null, 2),
      "utf8",
    );
  } catch (err) {
    console.warn(
      "[idempotency] write failed",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Returns a cached response body if the key was seen for this route.
 */
export async function withIdempotency(
  key: string | null | undefined,
  route: string,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<{ status: number; body: unknown; replayed: boolean }> {
  const k = (key || "").trim();
  if (!k) {
    const result = await run();
    return { ...result, replayed: false };
  }

  pruneMemory();
  const mk = memKey(route, k);
  const memHit = memory.get(mk);
  if (memHit && memHit.expiresAt > Date.now()) {
    return {
      status: memHit.status,
      body: memHit.body,
      replayed: true,
    };
  }

  if (!isServerlessRuntime()) {
    const all = await readAll();
    const hit = all.find((r) => r.key === k && r.route === route);
    if (hit) {
      return { status: hit.status, body: hit.body, replayed: true };
    }

    const result = await run();
    const row: IdemRecord = {
      key: k,
      route,
      status: result.status,
      body: result.body,
      createdAt: new Date().toISOString(),
    };
    all.push(row);
    memory.set(mk, { ...row, expiresAt: Date.now() + MEMORY_TTL_MS });
    await writeAll(all);
    return { ...result, replayed: false };
  }

  // Serverless: memory-only (same instance). Prefer DB unique keys for money paths.
  const result = await run();
  memory.set(mk, {
    key: k,
    route,
    status: result.status,
    body: result.body,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });
  return { ...result, replayed: false };
}

export function idempotencyKeyFrom(request: Request): string | null {
  return (
    request.headers.get("Idempotency-Key") ||
    request.headers.get("idempotency-key") ||
    null
  );
}
