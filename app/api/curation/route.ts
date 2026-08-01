import { NextRequest, NextResponse } from "next/server";
import { publicId } from "@/lib/ids";
import { listApplications, saveApplications } from "@/lib/m1-store";
import type { CurationApplication, CurationDecision } from "@/lib/curation-policy";
import { ADMISSION_CRITERIA, REJECTION_CLASSES } from "@/lib/curation-policy";
import { appendUsageEvent } from "@/lib/m1-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";

export async function GET() {
  const applications = await listApplications();
  return NextResponse.json({
    data: {
      applications,
      criteria: ADMISSION_CRITERIA,
      rejectionClasses: REJECTION_CLASSES,
    },
  });
}

/** Vendor application → pending queue */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const businessName = String(body?.businessName || "").trim();
    const contactEmail = String(body?.contactEmail || "").trim();
    if (!businessName || !contactEmail) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "businessName and contactEmail required" } },
        { status: 400 },
      );
    }

    const app: CurationApplication = {
      id: publicId("ven"),
      businessName,
      neighbourhood: String(body?.neighbourhood || "Nairobi").trim(),
      contactEmail,
      contactPhone: String(body?.contactPhone || "").trim(),
      categories: Array.isArray(body?.categories) ? body.categories.map(String) : [],
      notes: body?.notes ? String(body.notes) : undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const apps = await listApplications();
    apps.unshift(app);
    await saveApplications(apps);

    await appendUsageEvent({
      id: publicId("evt"),
      name: "vendor.application_submitted",
      properties: { applicationId: app.id, businessName: app.businessName },
      actorType: "vendor",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ data: app }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "WRITE_FAILED", message: "Could not save application" } },
      { status: 500 },
    );
  }
}

/** Record admit/reject decision (who / when / why) — M1 DoD */
export async function PATCH(request: NextRequest) {
  try {
    const gate = await requireVendorActor();
    if (!gate.ok) return gate.response;
    const actor = gate.actor.email || gate.actor.userId;

    const body = await request.json();
    const id = String(body?.id || "");
    const outcome = body?.outcome === "admitted" ? "admitted" : body?.outcome === "rejected" ? "rejected" : null;
    const reason = String(body?.reason || "").trim();
    const decidedBy = String(body?.decidedBy || actor).trim();

    if (!id || !outcome || !reason) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "id, outcome, and reason required" } },
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
      outcome,
      criteriaChecked: Array.isArray(body?.criteriaChecked) ? body.criteriaChecked : [],
      rejectionClasses: outcome === "rejected" && Array.isArray(body?.rejectionClasses)
        ? body.rejectionClasses
        : undefined,
      reason,
    };

    apps[idx] = {
      ...apps[idx],
      status: outcome,
      decision,
    };
    await saveApplications(apps);

    await appendUsageEvent({
      id: publicId("evt"),
      name: outcome === "admitted" ? "vendor.admitted" : "vendor.rejected",
      properties: {
        applicationId: id,
        businessName: apps[idx].businessName,
        decidedBy,
        reason,
      },
      actorType: "admin",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ data: apps[idx] });
  } catch {
    return NextResponse.json(
      { error: { code: "WRITE_FAILED", message: "Could not record decision" } },
      { status: 500 },
    );
  }
}
