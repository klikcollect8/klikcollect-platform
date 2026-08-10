import { NextRequest, NextResponse } from "next/server";
import { publicId } from "@/lib/ids";
import {
  insertApplication,
  listApplications,
  listApplicationsForUser,
  saveApplications,
  updateApplication,
} from "@/lib/m1-store";
import type {
  CurationApplication,
  CurationDecision,
} from "@/lib/curation-policy";
import {
  ADMISSION_CRITERIA,
  CURATION_MAX_SUBMITS_PER_WINDOW,
  CURATION_SUBMIT_WINDOW_DAYS,
  REJECTION_CLASSES,
} from "@/lib/curation-policy";
import { appendUsageEvent } from "@/lib/m1-store";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";
import {
  provisionAdmittedVendor,
  suspendVendor,
} from "@/lib/vendors/provision";

export async function GET() {
  try {
    await requireAdminPermission("vendors:approve");
  } catch (e) {
    return handleRequireAdminError(e);
  }

  const applications = await listApplications();
  return NextResponse.json({
    data: {
      applications,
      criteria: ADMISSION_CRITERIA,
      rejectionClasses: REJECTION_CLASSES,
    },
  });
}

function parseDetails(body: unknown): CurationApplication["details"] {
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "details" in body
  ) {
    const details = (body as { details?: unknown }).details;
    if (details && typeof details === "object" && !Array.isArray(details)) {
      return details as CurationApplication["details"];
    }
  }
  return undefined;
}

/** Vendor application → pending queue (signed-in applicants only) */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireClerkUser();
    if (!actor) return unauthorizedJson("Sign in to submit a sell application");

    const body = await request.json();
    const businessName = String(body?.businessName || "").trim();
    const contactEmail = (
      actor.email || String(body?.contactEmail || "")
    ).trim();
    if (!businessName || !contactEmail) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID",
            message: "businessName and contactEmail required",
          },
        },
        { status: 400 },
      );
    }

    const existing = await listApplicationsForUser(actor.userId);
    const pending = existing.find((a) => a.status === "pending");
    if (pending) {
      return NextResponse.json(
        {
          error: {
            code: "PENDING_EXISTS",
            message:
              "You already have a pending application. Track or edit it from your account.",
            applicationId: pending.id,
          },
        },
        { status: 409 },
      );
    }

    const windowMs = CURATION_SUBMIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const since = Date.now() - windowMs;
    const recentSubmits = existing.filter(
      (a) => new Date(a.createdAt).getTime() >= since,
    ).length;
    if (recentSubmits >= CURATION_MAX_SUBMITS_PER_WINDOW) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: `You can submit at most ${CURATION_MAX_SUBMITS_PER_WINDOW} applications every ${CURATION_SUBMIT_WINDOW_DAYS} days.`,
          },
        },
        { status: 429 },
      );
    }

    const now = new Date().toISOString();
    const app: CurationApplication = {
      id: publicId("ven"),
      businessName,
      neighbourhood: String(body?.neighbourhood || "Nairobi").trim(),
      contactEmail,
      contactPhone: String(body?.contactPhone || "").trim(),
      categories: Array.isArray(body?.categories)
        ? body.categories.map(String)
        : [],
      notes: body?.notes ? String(body.notes) : undefined,
      details: parseDetails(body),
      clerkUserId: actor.userId,
      editCount: 0,
      updatedAt: now,
      status: "pending",
      createdAt: now,
    };

    const saved = await insertApplication(app);

    await appendUsageEvent({
      id: publicId("evt"),
      name: "vendor.application_submitted",
      properties: {
        applicationId: saved.id,
        businessName: saved.businessName,
        clerkUserId: actor.userId,
      },
      actorType: "vendor",
      createdAt: now,
    });

    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("curation_one_pending_per_user") || msg.includes("23505")) {
      return NextResponse.json(
        {
          error: {
            code: "PENDING_EXISTS",
            message:
              "You already have a pending application. Track or edit it from your account.",
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: { code: "WRITE_FAILED", message: "Could not save application" },
      },
      { status: 500 },
    );
  }
}

/** Record admit/reject/suspend — platform admin only; admit provisions tenant. */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPermission("vendors:approve");
    const actor = admin.user.email || admin.user.id;

    const body = await request.json();
    const id = String(body?.id || "");
    const outcome =
      body?.outcome === "admitted"
        ? "admitted"
        : body?.outcome === "rejected"
          ? "rejected"
          : body?.outcome === "suspended"
            ? "suspended"
            : null;
    const reason = String(body?.reason || "").trim();
    const decidedBy = String(body?.decidedBy || actor).trim();

    if (!id || !outcome || !reason) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID",
            message: "id, outcome, and reason required",
          },
        },
        { status: 400 },
      );
    }

    const apps = await listApplications();
    const idx = apps.findIndex((a) => a.id === id);
    if (idx < 0) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Application not found" } },
        { status: 404 },
      );
    }

    const decision: CurationDecision = {
      decidedAt: new Date().toISOString(),
      decidedBy,
      outcome: outcome === "suspended" ? "rejected" : outcome,
      criteriaChecked: Array.isArray(body?.criteriaChecked)
        ? body.criteriaChecked
        : [],
      rejectionClasses:
        (outcome === "rejected" || outcome === "suspended") &&
        Array.isArray(body?.rejectionClasses)
          ? body.rejectionClasses
          : undefined,
      reason,
    };

    let provision: Awaited<ReturnType<typeof provisionAdmittedVendor>> | null =
      null;

    if (outcome === "admitted") {
      provision = await provisionAdmittedVendor(apps[idx]);
    } else if (outcome === "suspended") {
      await suspendVendor(apps[idx].id).catch(() => undefined);
    }

    const updated: CurationApplication = {
      ...apps[idx],
      status: outcome === "suspended" ? "rejected" : outcome,
      decision,
      updatedAt: new Date().toISOString(),
    };
    apps[idx] = updated;
    await updateApplication(updated).catch(async () => {
      await saveApplications(apps);
    });

    await appendUsageEvent({
      id: publicId("evt"),
      name:
        outcome === "admitted"
          ? "vendor.admitted"
          : outcome === "suspended"
            ? "vendor.suspended"
            : "vendor.rejected",
      properties: {
        applicationId: id,
        businessName: updated.businessName,
        decidedBy,
        reason,
        vendorPublicId: provision?.vendorPublicId,
      },
      actorType: "admin",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      data: updated,
      provision,
    });
  } catch (e) {
    if (e instanceof Error && "status" in e) {
      return handleRequireAdminError(e);
    }
    const msg = e instanceof Error ? e.message : "Could not record decision";
    return NextResponse.json(
      { error: { code: "WRITE_FAILED", message: msg } },
      { status: 500 },
    );
  }
}
