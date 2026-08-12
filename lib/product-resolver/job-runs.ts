import { getServiceSupabase } from "@/lib/supabase/admin";

export async function startJobRun(input: {
  jobType: "reconcile" | "enrich" | "source_health" | "offline_sync";
  actorClerkUserId?: string | null;
}): Promise<string | null> {
  try {
    const sb = getServiceSupabase();
    const { data } = await sb
      .from("catalogue_job_runs")
      .insert({
        job_type: input.jobType,
        status: "running",
        actor_clerk_user_id: input.actorClerkUserId || null,
      })
      .select("id")
      .single();
    return data?.id || null;
  } catch {
    return null;
  }
}

export async function finishJobRun(
  jobId: string | null,
  input: {
    status: "ok" | "error" | "partial";
    summary?: unknown;
    error?: string | null;
  },
): Promise<void> {
  if (!jobId) return;
  try {
    const sb = getServiceSupabase();
    await sb
      .from("catalogue_job_runs")
      .update({
        status: input.status,
        finished_at: new Date().toISOString(),
        summary: input.summary ?? {},
        error: input.error || null,
      })
      .eq("id", jobId);
  } catch {
    /* ignore */
  }
}

export async function listJobRuns(opts?: {
  jobType?: string;
  limit?: number;
}) {
  try {
    const sb = getServiceSupabase();
    let q = sb
      .from("catalogue_job_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(opts?.limit || 30);
    if (opts?.jobType) q = q.eq("job_type", opts.jobType);
    const { data } = await q;
    return data || [];
  } catch {
    return [];
  }
}
