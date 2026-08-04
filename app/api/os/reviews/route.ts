import { NextRequest, NextResponse } from "next/server";
import {
  requireVendorPermission,
  type VendorActor,
} from "@/lib/auth/require-vendor";
import { inVendorScope, vendorScopeIds } from "@/lib/auth/vendor-scope";
import { emitVendorActivity } from "@/lib/vendor-activity";
import { notifyVendorStaff } from "@/lib/vendor-notifications";
import {
  deleteVendorReview,
  deleteVendorReviewAnswer,
  listVendorReviews,
  replyToVendorReview,
  setVendorReviewStatus,
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
    const { reviews, products } = await listVendorReviews(scope);
    return NextResponse.json({ data: { reviews, products } });
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
  const reviewId = String(body?.reviewId || "");
  if (!reviewId) {
    return NextResponse.json(
      { error: { message: "reviewId required" } },
      { status: 400 },
    );
  }

  if (action === "reply") {
    const answer = String(body?.answer || "").trim();
    if (!answer) {
      return NextResponse.json(
        { error: { message: "answer required" } },
        { status: 400 },
      );
    }
    const userName =
      String(body?.userName || "").trim() ||
      gate.actor.email?.split("@")[0] ||
      "Store";
    const result = await replyToVendorReview(reviewId, scope, {
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
      title: "Replied to a review",
      body: answer.slice(0, 120),
      refType: "review",
      refId: reviewId,
    });
    await notifyVendorStaff({
      vendorPublicId: scope[0],
      title: "Review reply posted",
      body: answer.slice(0, 80),
      href: "/app/reviews",
      excludeClerkUserIds: [gate.actor.userId],
    });
    return NextResponse.json({ data: result });
  }

  if (action === "status") {
    const status = body?.status === "hidden" ? "hidden" : "approved";
    const result = await setVendorReviewStatus(reviewId, scope, status);
    if (!result.ok) {
      return NextResponse.json(
        { error: { message: result.reason } },
        { status: result.reason === "not_found" ? 404 : 500 },
      );
    }
    await emitVendorActivity({
      vendorPublicId: scope[0],
      kind: "review",
      title: status === "hidden" ? "Review hidden" : "Review approved",
      refType: "review",
      refId: reviewId,
      meta: { status },
    });
    return NextResponse.json({ data: result });
  }

  return NextResponse.json(
    { error: { message: "Unknown action" } },
    { status: 400 },
  );
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

  const reviewId = String(body?.reviewId || "");
  const answerId = body?.answerId ? String(body.answerId) : "";
  if (!reviewId) {
    return NextResponse.json(
      { error: { message: "reviewId required" } },
      { status: 400 },
    );
  }

  if (answerId) {
    const result = await deleteVendorReviewAnswer(
      reviewId,
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

  const result = await deleteVendorReview(reviewId, scope, gate.actor.userId);
  if (!result.ok) {
    return NextResponse.json(
      { error: { message: result.reason } },
      { status: result.reason === "not_found" ? 404 : 500 },
    );
  }
  await emitVendorActivity({
    vendorPublicId: scope[0],
    kind: "review",
    title: "Removed a review",
    refType: "review",
    refId: reviewId,
  });
  return NextResponse.json({ data: { ok: true } });
}
