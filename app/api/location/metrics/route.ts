import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight location-provider metrics.
 *
 * Clients flush in-session counter deltas (search/geocode/route success,
 * latency, cache hits) best-effort; aggregates live in process memory only
 * (reset on deploy/instance recycle — intentionally cheap, no PII, no DB).
 * Admin Location Quality reads the aggregate.
 */

const OPS = new Set([
  "search",
  "resolve_place",
  "reverse_geocode",
  "route",
  "matrix",
  "match_route",
  "isochrone",
]);

type OpAggregate = {
  attempts: number;
  successes: number;
  failures: number;
  cacheHits: number;
  totalLatencyMs: number;
};

const aggregate = new Map<string, OpAggregate>();
let sessionsReported = 0;
const startedAt = Date.now();

function addDelta(op: string, d: Partial<OpAggregate>) {
  let a = aggregate.get(op);
  if (!a) {
    a = { attempts: 0, successes: 0, failures: 0, cacheHits: 0, totalLatencyMs: 0 };
    aggregate.set(op, a);
  }
  const clamp = (v: unknown) =>
    Math.min(Math.max(0, Math.floor(Number(v) || 0)), 1_000_000);
  a.attempts += clamp(d.attempts);
  a.successes += clamp(d.successes);
  a.failures += clamp(d.failures);
  a.cacheHits += clamp(d.cacheHits);
  a.totalLatencyMs += clamp(d.totalLatencyMs);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      ops?: Record<string, Partial<OpAggregate>>;
    } | null;
    if (body?.ops && typeof body.ops === "object") {
      let counted = false;
      for (const [op, delta] of Object.entries(body.ops)) {
        if (!OPS.has(op) || !delta || typeof delta !== "object") continue;
        addDelta(op, delta);
        counted = true;
      }
      if (counted) sessionsReported += 1;
    }
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    await requireAdminPermission("system:health");
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 401 },
    );
  }
  const ops = Object.fromEntries(
    [...aggregate.entries()].map(([op, a]) => [
      op,
      {
        ...a,
        avgLatencyMs: a.attempts
          ? Math.round(a.totalLatencyMs / a.attempts)
          : 0,
        successRate: a.attempts ? a.successes / a.attempts : 1,
      },
    ]),
  );
  return NextResponse.json({
    ops,
    sessionsReported,
    since: new Date(startedAt).toISOString(),
  });
}
