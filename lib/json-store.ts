/**
 * JSON persistence with in-memory primary store.
 * Disk writes are best-effort so serverless (Vercel) still serves seed data
 * when `.data` is missing or read-only.
 */
import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR, ensureDataDir } from "@/lib/data-dir";

const memory = new Map<string, unknown>();

export async function readJsonStore<T>(file: string, fallback: T): Promise<T> {
  if (memory.has(file)) {
    return memory.get(file) as T;
  }

  try {
    await ensureDataDir();
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
    const data = JSON.parse(raw) as T;
    memory.set(file, data);
    return data;
  } catch {
    return fallback;
  }
}

export async function writeJsonStore<T>(file: string, data: T): Promise<void> {
  memory.set(file, data);
  try {
    const ok = await ensureDataDir();
    if (!ok) return;
    await fs.writeFile(
      path.join(DATA_DIR, file),
      JSON.stringify(data, null, 2),
      "utf8",
    );
  } catch (err) {
    console.warn(
      `[json-store] disk write failed for ${file}; serving from memory`,
      err instanceof Error ? err.message : err,
    );
  }
}
