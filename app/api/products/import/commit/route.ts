import { NextRequest, NextResponse } from "next/server";
import { V1_CATEGORIES, V1_EXCLUDED_CATEGORIES } from "@/lib/curation-policy";
import { addCatalogueProducts } from "@/lib/catalogue-store";
import { DEMO_VENDOR_ID } from "@/lib/tenancy";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";
import { requireVendorActor } from "@/lib/auth/require-vendor";

/**
 * Commit bulk import after dry-run (M1 DoD).
 * Tenant-scoped write to local catalogue store — INV-9 from first listing.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireVendorActor();
    if (!gate.ok) return gate.response;

    const body = await request.json();
    const csv = String(body?.csv || "");
    let vendorId = String(body?.vendorId || DEMO_VENDOR_ID).trim() || DEMO_VENDOR_ID;
    if (
      !gate.actor.isPlatformAdmin &&
      !gate.actor.vendorIds.includes(vendorId)
    ) {
      vendorId = gate.actor.vendorIds[0] || DEMO_VENDOR_ID;
    }

    if (!csv.trim()) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "csv string required" } },
        { status: 400 },
      );
    }

    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "CSV needs a header and at least one row" } },
        { status: 400 },
      );
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const required = ["name", "category", "price", "stock"];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_HEADER",
            message: `Missing columns: ${missing.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const idx = {
      name: header.indexOf("name"),
      category: header.indexOf("category"),
      price: header.indexOf("price"),
      stock: header.indexOf("stock"),
      description: header.indexOf("description"),
    };

    const allowed = new Set(V1_CATEGORIES.map((c) => c.toLowerCase()));
    const excluded = new Set(V1_EXCLUDED_CATEGORIES.map((c) => c.toLowerCase()));
    const validRows: Array<{
      name: string;
      category: string;
      priceMajor: number;
      stock: number;
      description?: string;
    }> = [];

    for (const line of lines.slice(1)) {
      const cols = splitCsvLine(line);
      const name = (cols[idx.name] || "").trim();
      const category = (cols[idx.category] || "").trim();
      const price = Number((cols[idx.price] || "").trim());
      const stock = Number((cols[idx.stock] || "").trim());
      const description =
        idx.description >= 0 ? (cols[idx.description] || "").trim() : undefined;

      if (!name || !category) continue;
      if (excluded.has(category.toLowerCase())) continue;
      if (!allowed.has(category.toLowerCase())) continue;
      if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) continue;
      if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) continue;

      validRows.push({ name, category, priceMajor: price, stock, description });
    }

    if (!validRows.length) {
      return NextResponse.json(
        { error: { code: "NO_VALID_ROWS", message: "No valid rows to commit" } },
        { status: 400 },
      );
    }

    const created = await addCatalogueProducts(
      validRows.map((r) => ({
        ...r,
        vendorId,
        status: "published" as const,
      })),
    );

    await appendUsageEvent({
      id: publicId("evt"),
      name: "catalogue.import_committed",
      properties: { count: created.length, vendorId },
      actorType: "vendor",
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
          })),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "COMMIT_FAILED", message: "Could not commit import" } },
      { status: 500 },
    );
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
