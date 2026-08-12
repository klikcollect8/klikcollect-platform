import { NextRequest, NextResponse } from "next/server";
import { requireJobAuth } from "@/lib/catalogue/job-auth";
import { handleRequireAdminError } from "@/lib/auth/require-admin";
import { runReconciliation } from "@/lib/product-resolver/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireJobAuth(req);
    const body = await req.json().catch(() => ({}));
    const summary = await runReconciliation({
      limit: Number(body?.limit || 25),
      probeSources: body?.probeSources !== false,
      actorClerkUserId: auth.userId,
    });
    return NextResponse.json({ ok: true, via: auth.via, summary });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return handleRequireAdminError(error);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Reconcile failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
