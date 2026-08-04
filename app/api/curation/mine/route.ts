import { NextRequest, NextResponse } from "next/server";
import { publicId } from "@/lib/ids";
import {
  getApplicationById,
  listApplicationsForUser,
  updateApplication,
  appendUsageEvent,
} from "@/lib/m1-store";
import {
  CURATION_MAX_EDITS,
  type CurationApplication,
} from "@/lib/curation-policy";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";

/** List the signed-in user's sell applications (live tracking). */
export async function GET() {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const applications = await listApplicationsForUser(actor.userId);
  return NextResponse.json({
    data: {
      applications,
      limits: {
        maxEdits: CURATION_MAX_EDITS,
      },
    },
  });
}

/** Applicant self-edit of a pending application (max 3 edits). */
export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson("Sign in to edit your application");

    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "id required" } },
        { status: 400 },
      );
    }

    const existing = await getApplicationById(id);
    if (!existing || existing.clerkUserId !== actor.userId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Application not found" } },
        { status: 404 },
      );
    }
    if (existing.status !== "pending") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_EDITABLE",
            message: "Only pending applications can be edited",
          },
        },
        { status: 409 },
      );
    }
    if (existing.editCount >= CURATION_MAX_EDITS) {
      return NextResponse.json(
        {
          error: {
            code: "EDIT_LIMIT",
            message: `You can edit an application at most ${CURATION_MAX_EDITS} times.`,
            editCount: existing.editCount,
            maxEdits: CURATION_MAX_EDITS,
          },
        },
        { status: 409 },
      );
    }

    const businessName = String(
      body?.businessName ?? existing.businessName,
    ).trim();
    if (!businessName) {
      return NextResponse.json(
        {
          error: { code: "INVALID", message: "businessName required" },
        },
        { status: 400 },
      );
    }

    const details =
      body?.details &&
      typeof body.details === "object" &&
      !Array.isArray(body.details)
        ? (body.details as CurationApplication["details"])
        : existing.details;

    const now = new Date().toISOString();
    const next: CurationApplication = {
      ...existing,
      businessName,
      neighbourhood: String(
        body?.neighbourhood ?? existing.neighbourhood,
      ).trim(),
      contactEmail: actor.email || existing.contactEmail,
      contactPhone: String(
        body?.contactPhone ?? existing.contactPhone ?? "",
      ).trim(),
      categories: Array.isArray(body?.categories)
        ? body.categories.map(String)
        : existing.categories,
      notes:
        body?.notes !== undefined
          ? body.notes
            ? String(body.notes)
            : undefined
          : existing.notes,
      details,
      editCount: existing.editCount + 1,
      updatedAt: now,
      clerkUserId: actor.userId,
      status: "pending",
    };

    const saved = await updateApplication(next);

    await appendUsageEvent({
      id: publicId("evt"),
      name: "vendor.application_edited",
      properties: {
        applicationId: saved.id,
        editCount: saved.editCount,
        clerkUserId: actor.userId,
      },
      actorType: "vendor",
      createdAt: now,
    });

    return NextResponse.json({
      data: saved,
      limits: {
        maxEdits: CURATION_MAX_EDITS,
        editsRemaining: Math.max(0, CURATION_MAX_EDITS - saved.editCount),
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "WRITE_FAILED", message: "Could not update application" } },
      { status: 500 },
    );
  }
}
