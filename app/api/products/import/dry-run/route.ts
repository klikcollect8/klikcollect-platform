import { NextRequest, NextResponse } from "next/server";
import { V1_CATEGORIES, V1_EXCLUDED_CATEGORIES } from "@/lib/curation-policy";
import { publicId } from "@/lib/ids";
import { appendUsageEvent } from "@/lib/m1-store";

type RowError = { row: number; field?: string; message: string };
type RowPreview = {
  row: number;
  name: string;
  category: string;
  priceMajor: number;
  stock: number;
  ok: boolean;
};

/**
 * Bulk catalogue import dry-run (M1 DoD / Ch 03 P-V1).
 * Does not write products - returns preview + errors only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const csv = String(body?.csv || "");
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
        {
          error: {
            code: "INVALID",
            message: "CSV needs a header and at least one row",
          },
        },
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
            message: `Missing columns: ${missing.join(", ")}. Expected: name,category,price,stock,description?`,
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

    const errors: RowError[] = [];
    const preview: RowPreview[] = [];
    const allowed = new Set(V1_CATEGORIES.map((c) => c.toLowerCase()));
    const excluded = new Set(
      V1_EXCLUDED_CATEGORIES.map((c) => c.toLowerCase()),
    );

    lines.slice(1).forEach((line, i) => {
      const rowNum = i + 2;
      const cols = splitCsvLine(line);
      const name = (cols[idx.name] || "").trim();
      const category = (cols[idx.category] || "").trim();
      const priceRaw = (cols[idx.price] || "").trim();
      const stockRaw = (cols[idx.stock] || "").trim();
      const price = Number(priceRaw);
      const stock = Number(stockRaw);
      let ok = true;

      if (!name) {
        errors.push({ row: rowNum, field: "name", message: "Name required" });
        ok = false;
      }
      if (!category) {
        errors.push({
          row: rowNum,
          field: "category",
          message: "Category required",
        });
        ok = false;
      } else if (excluded.has(category.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: "category",
          message: `Category excluded from V1: ${category}`,
        });
        ok = false;
      } else if (!allowed.has(category.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: "category",
          message: `Not in V1 launch categories: ${category}`,
        });
        ok = false;
      }
      if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
        errors.push({
          row: rowNum,
          field: "price",
          message:
            "Price must be a non-negative integer (KES major units for dry-run)",
        });
        ok = false;
      }
      if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
        errors.push({
          row: rowNum,
          field: "stock",
          message: "Stock must be a non-negative integer",
        });
        ok = false;
      }

      preview.push({
        row: rowNum,
        name: name || "(missing)",
        category: category || "(missing)",
        priceMajor: Number.isFinite(price) ? price : 0,
        stock: Number.isFinite(stock) ? stock : 0,
        ok,
      });
    });

    const valid = preview.filter((p) => p.ok).length;
    const invalid = preview.length - valid;

    await appendUsageEvent({
      id: publicId("evt"),
      name: "catalogue.import_dry_run",
      properties: { rows: preview.length, valid, invalid },
      actorType: "vendor",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      data: {
        summary: { rows: preview.length, valid, invalid },
        preview: preview.slice(0, 100),
        errors: errors.slice(0, 100),
        v1Categories: V1_CATEGORIES,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "PARSE_FAILED", message: "Could not parse CSV" } },
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
