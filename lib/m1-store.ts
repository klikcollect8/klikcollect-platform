import { promises as fs } from "fs";
import path from "path";
import type { CurationApplication } from "./curation-policy";

const DATA_DIR = path.join(process.cwd(), ".data");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  await ensureDir();
  const full = path.join(DATA_DIR, file);
  try {
    const raw = await fs.readFile(full, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await ensureDir();
  const full = path.join(DATA_DIR, file);
  await fs.writeFile(full, JSON.stringify(data, null, 2), "utf8");
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
  await ensureDir();
  const full = path.join(DATA_DIR, "usage-events.jsonl");
  await fs.appendFile(full, `${JSON.stringify(event)}\n`, "utf8");
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
