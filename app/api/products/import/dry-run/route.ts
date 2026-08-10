import { NextRequest, NextResponse } from "next/server";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import { validateCatalogueCsvRows } from "@/lib/catalogue/bulk-import";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";

/**
 * Bulk catalogue import dry-run.
 * Does not write products — returns preview + errors/warnings only.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminPermission("products:create");

    const body = await request.json();
    const csv = String(body?.csv || "");
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

    await appendUsageEvent({
      id: publicId("evt"),
      name: "catalogue.import_dry_run",
      properties: {
        rows: result.summary.rows,
        valid: result.summary.valid,
        invalid: result.summary.invalid,
        warnings: result.summary.warnings,
      },
      actorType: "admin",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      data: {
        summary: result.summary,
        preview: result.preview.slice(0, 100),
        errors: result.errors.slice(0, 100),
        canCommit: result.summary.invalid === 0 && result.summary.valid > 0,
        v1Categories: V1_CATEGORIES,
      },
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return handleRequireAdminError(error);
    }
    return NextResponse.json(
      { error: { code: "PARSE_FAILED", message: "Could not parse CSV" } },
      { status: 500 },
    );
  }
}
