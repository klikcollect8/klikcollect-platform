import { NextRequest, NextResponse } from "next/server";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";
import { listCatalogueCorrections } from "@/lib/offers-mutations";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { writeProductAudit } from "@/lib/catalogue/audit";

export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission("products:edit");
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const rows = await listCatalogueCorrections({ status, limit: 200 });
    return NextResponse.json({ data: rows });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminPermission("products:edit");
    const body = await request.json();
    const publicId = String(body?.publicId || "");
    const status = String(body?.status || "");
    const adminNotes = body?.adminNotes ? String(body.adminNotes) : null;
    const applyFields = body?.applyFields === true;
    const fieldOverrides =
      body?.fieldOverrides && typeof body.fieldOverrides === "object"
        ? (body.fieldOverrides as Record<string, string>)
        : null;

    if (
      !publicId ||
      !["open", "in_review", "resolved", "rejected"].includes(status)
    ) {
      return NextResponse.json(
        { error: { message: "publicId and valid status required" } },
        { status: 400 },
      );
    }

    const sb = getServiceSupabase();
    const { data: existing } = await sb
      .from("catalogue_correction_requests")
      .select("*")
      .eq("public_id", publicId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json(
        { error: { message: "Correction not found" } },
        { status: 404 },
      );
    }

    let applied: Record<string, string> | null = null;
    if (status === "resolved" && applyFields) {
      const productPublicId = String(existing.product_public_id || "");
      const suggested = (existing.fields as Record<string, string>) || {};
      const toApply = fieldOverrides || suggested;
      const productPatch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      for (const [key, value] of Object.entries(toApply)) {
        if (!value || value === "needs_correction") continue;
        if (key === "name") productPatch.name = value;
        else if (key === "description") productPatch.description = value;
        else if (key === "barcode") productPatch.barcode = value;
        else if (key === "gtin") productPatch.gtin = value;
        else if (key === "sku") productPatch.sku = value;
        else if (
          key === "brand" ||
          key === "brandName" ||
          key === "manufacturer"
        )
          productPatch.manufacturer = value;
      }
      if (Object.keys(productPatch).length > 1 && productPublicId) {
        const { data: before } = await sb
          .from("products")
          .select("name, description, barcode, gtin, sku, manufacturer, version")
          .eq("public_id", productPublicId)
          .maybeSingle();
        const { error: prodErr } = await sb
          .from("products")
          .update({
            ...productPatch,
            version: Number(before?.version || 1) + 1,
          })
          .eq("public_id", productPublicId);
        if (prodErr) {
          return NextResponse.json(
            { error: { message: prodErr.message } },
            { status: 500 },
          );
        }
        applied = Object.fromEntries(
          Object.entries(productPatch)
            .filter(([k]) => k !== "updated_at")
            .map(([k, v]) => [k, String(v)]),
        );
        await writeProductAudit({
          productPublicId,
          actorClerkUserId: admin.user.id,
          actorEmail: admin.user.email || null,
          action: "correction.fields_applied",
          before,
          after: applied,
          reason: adminNotes || existing.message || null,
        });
      }
    }

    const patch: Record<string, unknown> = {
      status,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString(),
    };
    if (status === "resolved" || status === "rejected") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by_clerk_id = admin.user.id;
    }

    const { data, error } = await sb
      .from("catalogue_correction_requests")
      .update(patch)
      .eq("public_id", publicId)
      .select("*")
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }

    await writeProductAudit({
      productPublicId: String(existing.product_public_id),
      actorClerkUserId: admin.user.id,
      actorEmail: admin.user.email || null,
      action: `correction.${status}`,
      before: {
        correctionId: publicId,
        status: existing.status,
        fields: existing.fields,
      },
      after: {
        status,
        adminNotes,
        applied,
      },
      reason: adminNotes || existing.message || null,
    });

    return NextResponse.json({ data, applied });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
