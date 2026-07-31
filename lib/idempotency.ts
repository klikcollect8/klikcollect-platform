import { promises as fs } from "fs";
import path from "path";
import { publicId } from "./ids";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = "idempotency.json";

type Record = {
  key: string;
  route: string;
  status: number;
  body: unknown;
  createdAt: string;
};

async function readAll(): Promise<Record[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const data = JSON.parse(raw) as Record[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(rows: Record[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const trimmed = rows.slice(-500);
  await fs.writeFile(path.join(DATA_DIR, FILE), JSON.stringify(trimmed, null, 2), "utf8");
}

/**
 * INV-5 state-mutating idempotency.
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

  const all = await readAll();
  const hit = all.find((r) => r.key === k && r.route === route);
  if (hit) {
    return { status: hit.status, body: hit.body, replayed: true };
  }

  const result = await run();
  all.push({
    key: k,
    route,
    status: result.status,
    body: result.body,
    createdAt: new Date().toISOString(),
  });
  await writeAll(all);
  return { ...result, replayed: false };
}

export function idempotencyKeyFrom(request: Request): string | null {
  return request.headers.get("Idempotency-Key") || request.headers.get("idempotency-key");
}

export function newIdempotencyKey() {
  return publicId("idem");
}
