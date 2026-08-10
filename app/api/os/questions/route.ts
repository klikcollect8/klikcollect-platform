import { NextRequest, NextResponse } from "next/server";
import {
  requireVendorPermission,
  type VendorActor,
} from "@/lib/auth/require-vendor";
import { inVendorScope, vendorScopeIds } from "@/lib/auth/vendor-scope";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";
import {
  listVendorQuestions,
  replyToVendorQuestion,
} from "@/lib/vendor-content";
import { createContentReport } from "@/lib/content-reports";
import { FeatureUnavailableError } from "@/lib/offers-mutations";

function scopeFrom(actor: VendorActor, vendorId?: string | null): string[] {
  if (vendorId) {
    return inVendorScope(actor, vendorId) ? [vendorId] : [];
  }
  return vendorScopeIds(actor);
}

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("content:moderate", { vendorId });
  if (!gate.ok) return gate.response;

  const scope = scopeFrom(gate.actor, vendorId);
  try {
    const { questions, products } = await listVendorQuestions(scope);
    return NextResponse.json({ data: { questions, products } });
  } catch (e) {
    return NextResponse.json(
      { error: { message: e instanceof Error ? e.message : "Failed to load" } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const vendorId = String(body?.vendorId || "");
  const gate = await requireVendorPermission("content:moderate", {
    vendorId: vendorId || undefined,
  });
  if (!gate.ok) return gate.response;

  const scope = scopeFrom(gate.actor, vendorId || null);
  if (!scope.length) {
    return NextResponse.json(
      { error: { message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const action = String(body?.action || "reply");
  const questionId = String(body?.questionId || "");
  if (!questionId) {
    return NextResponse.json(
      { error: { message: "questionId required" } },
      { status: 400 },
    );
  }

  if (action === "report") {
    const reason = String(body?.reason || "inappropriate").trim() || "other";
    const message = String(body?.message || "").trim();
    try {
      const created = await createContentReport({
        vendorPublicId: scope[0],
        actorClerkId: gate.actor.userId,
        targetType: "question",
        targetId: questionId,
        reason,
        message,
      });
      await emitVendorActivity({
        vendorPublicId: scope[0],
        kind: "review",
        title: "Question reported to KlikCollect",
        body: message.slice(0, 120) || reason,
        refType: "content_report",
        refId: created.publicId,
      });
      return NextResponse.json({ data: created }, { status: 201 });
    } catch (e) {
      if (e instanceof FeatureUnavailableError) {
        return NextResponse.json(
          { error: { code: e.code, message: e.message } },
          { status: 503 },
        );
      }
      return NextResponse.json(
        {
          error: {
            message: e instanceof Error ? e.message : "Report failed",
          },
        },
        { status: 500 },
      );
    }
  }

  const answer = String(body?.answer || "").trim();
  if (!answer) {
    return NextResponse.json(
      { error: { message: "questionId and answer required" } },
      { status: 400 },
    );
  }

  const userName =
    String(body?.userName || "").trim() ||
    gate.actor.email?.split("@")[0] ||
    "Store";
  const result = await replyToVendorQuestion(questionId, scope, {
    userName,
    answer,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: { message: result.reason } },
      { status: result.reason === "not_found" ? 404 : 500 },
    );
  }

  await emitVendorActivity({
    vendorPublicId: scope[0],
    kind: "review",
    title: "Answered a product question",
    body: answer.slice(0, 120),
    refType: "question",
    refId: questionId,
  });
  await notifyVendorStaff({
    vendorPublicId: scope[0],
    title: "Question answered",
    body: answer.slice(0, 80),
    href: "/app/questions",
    excludeClerkUserIds: [gate.actor.userId],
  });

  return NextResponse.json({ data: result });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    {
      error: {
        message:
          "Vendors cannot delete questions. Answer or report — KlikCollect moderates removals.",
      },
    },
    { status: 403 },
  );
}
