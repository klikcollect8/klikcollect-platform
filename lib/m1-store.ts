import { promises as fs } from "fs";
import path from "path";
import type { CurationApplication } from "./curation-policy";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { DATA_DIR, ensureDataDir } from "@/lib/data-dir";

async function ensureDir() {
  await ensureDataDir();
}

export type UsageEvent = {
  id: string;
  name: string;
  properties?: Record<string, unknown>;
  actorType?: "customer" | "vendor" | "admin" | "anonymous";
  createdAt: string;
};

type ApplicationRow = {
  public_id: string;
  status: string;
  payload: Record<string, unknown> | null;
  pitch?: string | null;
  created_at: string;
  clerk_user_id?: string | null;
  edit_count?: number | null;
  updated_at?: string | null;
};

function mapApplication(row: ApplicationRow): CurationApplication {
  const p = row.payload || {};
  const status =
    row.status === "admitted" || row.status === "rejected"
      ? row.status
      : row.status === "decided"
        ? "admitted"
        : "pending";
  const editCount =
    typeof row.edit_count === "number"
      ? row.edit_count
      : typeof p.editCount === "number"
        ? p.editCount
        : 0;
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
    details:
      p.details && typeof p.details === "object"
        ? (p.details as CurationApplication["details"])
        : undefined,
    clerkUserId:
      row.clerk_user_id ||
      (typeof p.clerkUserId === "string" ? p.clerkUserId : undefined),
    editCount,
    updatedAt: row.updated_at || undefined,
    status,
    createdAt: row.created_at,
    decision: p.decision as CurationApplication["decision"],
  };
}

function appPayload(app: CurationApplication) {
  return {
    businessName: app.businessName,
    neighbourhood: app.neighbourhood,
    contactEmail: app.contactEmail,
    contactPhone: app.contactPhone,
    categories: app.categories,
    notes: app.notes,
    details: app.details,
    decision: app.decision,
    clerkUserId: app.clerkUserId,
    editCount: app.editCount,
  };
}

export async function listApplications(): Promise<CurationApplication[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("curation_applications")
    .select(
      "public_id, status, payload, pitch, created_at, clerk_user_id, edit_count, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapApplication(row as ApplicationRow));
}

export async function listApplicationsForUser(
  clerkUserId: string,
): Promise<CurationApplication[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("curation_applications")
    .select(
      "public_id, status, payload, pitch, created_at, clerk_user_id, edit_count, updated_at",
    )
    .eq("clerk_user_id", clerkUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapApplication(row as ApplicationRow));
}

export async function getApplicationById(
  publicId: string,
): Promise<CurationApplication | null> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("curation_applications")
    .select(
      "public_id, status, payload, pitch, created_at, clerk_user_id, edit_count, updated_at",
    )
    .eq("public_id", publicId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapApplication(data as ApplicationRow) : null;
}

export async function insertApplication(
  app: CurationApplication,
): Promise<CurationApplication> {
  const sb = getServiceSupabase();
  const status =
    app.status === "admitted" || app.status === "rejected"
      ? app.status
      : "pending";
  const { data, error } = await sb
    .from("curation_applications")
    .insert({
      public_id: app.id,
      status,
      pitch: app.notes || app.businessName,
      payload: appPayload(app),
      clerk_user_id: app.clerkUserId || null,
      edit_count: app.editCount || 0,
      created_at: app.createdAt,
      updated_at: app.updatedAt || app.createdAt,
    })
    .select(
      "public_id, status, payload, pitch, created_at, clerk_user_id, edit_count, updated_at",
    )
    .single();
  if (error) throw error;
  return mapApplication(data as ApplicationRow);
}

export async function updateApplication(
  app: CurationApplication,
): Promise<CurationApplication> {
  const sb = getServiceSupabase();
  const status =
    app.status === "admitted" || app.status === "rejected"
      ? app.status
      : "pending";
  const updatedAt = app.updatedAt || new Date().toISOString();
  const { data, error } = await sb
    .from("curation_applications")
    .update({
      status,
      pitch: app.notes || app.businessName,
      payload: appPayload(app),
      clerk_user_id: app.clerkUserId || null,
      edit_count: app.editCount,
      updated_at: updatedAt,
    })
    .eq("public_id", app.id)
    .select(
      "public_id, status, payload, pitch, created_at, clerk_user_id, edit_count, updated_at",
    )
    .single();
  if (error) throw error;
  return mapApplication(data as ApplicationRow);
}

export async function saveApplications(
  apps: CurationApplication[],
): Promise<void> {
  const sb = getServiceSupabase();
  const { data: existing } = await sb
    .from("curation_applications")
    .select("public_id");
  const existingIds = new Set(
    (existing || []).map((r) => r.public_id as string),
  );
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
    await sb.from("curation_applications").upsert(
      {
        public_id: app.id,
        status,
        pitch: app.notes || app.businessName,
        payload: appPayload(app),
        clerk_user_id: app.clerkUserId || null,
        edit_count: app.editCount || 0,
        created_at: app.createdAt,
        updated_at: app.updatedAt || app.createdAt,
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
