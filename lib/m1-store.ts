/**
 * M1 usage events (local jsonl) + curation applications (Supabase).
 */
import { promises as fs } from "fs";
import path from "path";
import type { CurationApplication } from "./curation-policy";
import { getServiceSupabase } from "@/lib/supabase/admin";

const DATA_DIR = path.join(process.cwd(), ".data");

async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* serverless may not allow mkdir — ignore */
  }
}

export type UsageEvent = {
  id: string;
  name: string;
  properties?: Record<string, unknown>;
  actorType?: "customer" | "vendor" | "admin" | "anonymous";
  createdAt: string;
};

function mapApplication(row: {
  public_id: string;
  status: string;
  payload: Record<string, unknown> | null;
  pitch?: string | null;
  created_at: string;
}): CurationApplication {
  const p = row.payload || {};
  const status =
    row.status === "admitted" || row.status === "rejected"
      ? row.status
      : row.status === "decided"
        ? "admitted"
        : "pending";
  return {
    id: row.public_id,
    businessName: String(p.businessName || row.public_id),
    neighbourhood: String(p.neighbourhood || "Nairobi"),
    contactEmail: String(p.contactEmail || ""),
    contactPhone: String(p.contactPhone || ""),
    categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
    notes: p.notes
      ? String(p.notes)
      : row.pitch
        ? String(row.pitch)
        : undefined,
    status,
    createdAt: row.created_at,
    decision: p.decision as CurationApplication["decision"],
  };
}

export async function listApplications(): Promise<CurationApplication[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("curation_applications")
    .select("public_id, status, payload, pitch, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) =>
    mapApplication(row as Parameters<typeof mapApplication>[0]),
  );
}

export async function saveApplications(apps: CurationApplication[]): Promise<void> {
  const sb = getServiceSupabase();
  const { data: existing } = await sb
    .from("curation_applications")
    .select("public_id");
  const existingIds = new Set((existing || []).map((r) => r.public_id as string));
  const nextIds = new Set(apps.map((a) => a.id));

  for (const id of existingIds) {
    if (!nextIds.has(id)) {
      await sb.from("curation_applications").delete().eq("public_id", id);
    }
  }

  for (const app of apps) {
    const status =
      app.status === "admitted" || app.status === "rejected"
        ? app.status
        : "pending";
    const payload = {
      businessName: app.businessName,
      neighbourhood: app.neighbourhood,
      contactEmail: app.contactEmail,
      contactPhone: app.contactPhone,
      categories: app.categories,
      notes: app.notes,
      decision: app.decision,
    };
    await sb.from("curation_applications").upsert(
      {
        public_id: app.id,
        status,
        pitch: app.notes || app.businessName,
        payload,
        created_at: app.createdAt,
      },
      { onConflict: "public_id" },
    );
  }
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
