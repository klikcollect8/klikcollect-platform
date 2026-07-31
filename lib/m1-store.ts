import { promises as fs } from "fs";
import path from "path";
import type { CurationApplication } from "./curation-policy";
import { readJsonStore, writeJsonStore } from "./json-store";

const DATA_DIR = path.join(process.cwd(), ".data");

async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* serverless may not allow mkdir — ignore */
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  return readJsonStore<T>(file, fallback);
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await writeJsonStore(file, data);
}

export type UsageEvent = {
  id: string;
  name: string;
  properties?: Record<string, unknown>;
  actorType?: "customer" | "vendor" | "admin" | "anonymous";
  createdAt: string;
};

export async function listApplications(): Promise<CurationApplication[]> {
  return readJson<CurationApplication[]>("curation-applications.json", []);
}

export async function saveApplications(apps: CurationApplication[]): Promise<void> {
  await writeJson("curation-applications.json", apps);
}

export async function appendUsageEvent(event: UsageEvent): Promise<void> {
  try {
    await ensureDir();
    const full = path.join(DATA_DIR, "usage-events.jsonl");
    await fs.appendFile(full, `${JSON.stringify(event)}\n`, "utf8");
  } catch (err) {
    console.warn(
      "[m1-store] usage event append failed",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function countUsageEvents(): Promise<number> {
  await ensureDir();
  const full = path.join(DATA_DIR, "usage-events.jsonl");
  try {
    const raw = await fs.readFile(full, "utf8");
    return raw.split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

export async function recentUsageEvents(limit = 50): Promise<UsageEvent[]> {
  await ensureDir();
  const full = path.join(DATA_DIR, "usage-events.jsonl");
  try {
    const raw = await fs.readFile(full, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as UsageEvent)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}
