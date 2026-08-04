import { NextRequest, NextResponse } from "next/server";
import {
  requireVendorPermission,
  type VendorActor,
} from "@/lib/auth/require-vendor";
import { inVendorScope, vendorScopeIds } from "@/lib/auth/vendor-scope";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";
import {
  deleteVendorQuestion,
  deleteVendorQuestionAnswer,
  listVendorQuestions,
  replyToVendorQuestion,
} from "@/lib/vendor-content";

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

  const questionId = String(body?.questionId || "");
  const answer = String(body?.answer || "").trim();
  if (!questionId || !answer) {
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

  const questionId = String(body?.questionId || "");
  const answerId = body?.answerId ? String(body.answerId) : "";
  if (!questionId) {
    return NextResponse.json(
      { error: { message: "questionId required" } },
      { status: 400 },
    );
  }

  if (answerId) {
    const result = await deleteVendorQuestionAnswer(
      questionId,
      answerId,
      scope,
      gate.actor.userId,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: { message: result.reason } },
        {
          status:
            result.reason === "not_found" ||
            result.reason === "answer_not_found"
              ? 404
              : 500,
        },
      );
    }
    return NextResponse.json({ data: result });
  }

  const result = await deleteVendorQuestion(
    questionId,
    scope,
    gate.actor.userId,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: { message: result.reason } },
      { status: result.reason === "not_found" ? 404 : 500 },
    );
  }
  await emitVendorActivity({
    vendorPublicId: scope[0],
    kind: "review",
    title: "Removed a product question",
    refType: "question",
    refId: questionId,
  });
  return NextResponse.json({ data: { ok: true } });
}
