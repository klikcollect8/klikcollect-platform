import { NextRequest, NextResponse } from "next/server";
import { addCatalogueProducts } from "@/lib/catalogue-store";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import { validateCatalogueCsvRows } from "@/lib/catalogue/bulk-import";
import { writeProductAudit } from "@/lib/catalogue/audit";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";

/**
 * Platform-only bulk catalogue import.
 * All-or-nothing: refuses commit when any row has validation errors.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminPermission("products:create");

    const body = await request.json();
    const csv = String(body?.csv || "");
    const vendorId =
      String(body?.vendorId || DEMO_VENDOR_ID).trim() || DEMO_VENDOR_ID;
    const forcePartial = body?.allowPartial === true;

    if (!csv.trim()) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "csv string required" } },
        { status: 400 },
      );
    }

    const result = validateCatalogueCsvRows(csv);
    if (result.parseError) {
      return NextResponse.json(
        { error: { code: "INVALID", message: result.parseError } },
        { status: 400 },
      );
    }

    if (result.summary.invalid > 0 && !forcePartial) {
      return NextResponse.json(
        {
          error: {
            code: "ROWS_INVALID",
            message:
              "Import refused: fix all row errors then re-run dry-run. Pass allowPartial only for intentional partial commits.",
          },
          data: {
            summary: result.summary,
            errors: result.errors.slice(0, 50),
          },
        },
        { status: 400 },
      );
    }

    if (!result.validRows.length) {
      return NextResponse.json(
        {
          error: { code: "NO_VALID_ROWS", message: "No valid rows to commit" },
        },
        { status: 400 },
      );
    }

    const created = await addCatalogueProducts(
      result.validRows.map((r) => ({
        name: r.name,
        category: r.category,
        priceMajor: r.priceMajor,
        stock: r.stock,
        description: r.description,
        vendorId,
        status: "draft" as const,
        sku: r.sku,
        barcode: r.barcode,
        gtin: r.gtin,
      })),
    );

    for (const p of created) {
      await writeProductAudit({
        productPublicId: p.id,
        actorClerkUserId: admin.user.id,
        actorEmail: admin.user.email || null,
        action: "import.csv_created",
        after: {
          name: p.name,
          category: p.category,
          status: p.status,
          vendorId,
        },
        reason: "CSV bulk import",
      });
    }

    await appendUsageEvent({
      id: publicId("evt"),
      name: "catalogue.import_committed",
      properties: {
        count: created.length,
        vendorId,
        actorUserId: admin.user.id,
        refusedInvalid: result.summary.invalid,
      },
      actorType: "admin",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        data: {
          created: created.length,
          vendorId,
          products: created.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            status: p.status,
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return handleRequireAdminError(error);
    }
    return NextResponse.json(
      { error: { code: "COMMIT_FAILED", message: "Could not commit import" } },
      { status: 500 },
    );
  }
}
