/**
 * Shared CSV dry-run / commit validation for catalogue bulk import.
 * All-or-nothing: commit refuses if any row fails validation.
 */
import { V1_CATEGORIES, V1_EXCLUDED_CATEGORIES } from "@/lib/curation-policy";
import { validateGtin } from "@/lib/catalogue/gtin";

export type BulkRowError = {
  row: number;
  field?: string;
  level: "error" | "warn";
  message: string;
};

export type BulkRowPreview = {
  row: number;
  name: string;
  category: string;
  priceMajor: number;
  stock: number;
  sku?: string;
  barcode?: string;
  ok: boolean;
  warnings: string[];
};

export type BulkParsedRow = {
  row: number;
  name: string;
  category: string;
  priceMajor: number;
  stock: number;
  description?: string;
  sku?: string;
  barcode?: string;
  gtin?: string;
};

export function splitCsvLine(line: string): string[] {
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

export function parseCatalogueCsv(csv: string): {
  ok: boolean;
  error?: string;
  header: string[];
  lines: string[];
  idx: Record<string, number>;
} {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      ok: false,
      error: "CSV needs a header and at least one row",
      header: [],
      lines: [],
      idx: {},
    };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["name", "category", "price", "stock"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) {
    return {
      ok: false,
      error: `Missing columns: ${missing.join(", ")}. Expected: name,category,price,stock[,description,sku,barcode,gtin]`,
      header,
      lines,
      idx: {},
    };
  }

  const idx = {
    name: header.indexOf("name"),
    category: header.indexOf("category"),
    price: header.indexOf("price"),
    stock: header.indexOf("stock"),
    description: header.indexOf("description"),
    sku: header.indexOf("sku"),
    barcode: header.indexOf("barcode"),
    gtin: header.indexOf("gtin"),
  };

  return { ok: true, header, lines, idx };
}

export function validateCatalogueCsvRows(csv: string): {
  parseError?: string;
  errors: BulkRowError[];
  preview: BulkRowPreview[];
  validRows: BulkParsedRow[];
  summary: { rows: number; valid: number; invalid: number; warnings: number };
} {
  const parsed = parseCatalogueCsv(csv);
  if (!parsed.ok) {
    return {
      parseError: parsed.error,
      errors: [],
      preview: [],
      validRows: [],
      summary: { rows: 0, valid: 0, invalid: 0, warnings: 0 },
    };
  }

  const { lines, idx } = parsed;
  const errors: BulkRowError[] = [];
  const preview: BulkRowPreview[] = [];
  const validRows: BulkParsedRow[] = [];
  const allowed = new Set(V1_CATEGORIES.map((c) => c.toLowerCase()));
  const excluded = new Set(V1_EXCLUDED_CATEGORIES.map((c) => c.toLowerCase()));
  const seenSku = new Set<string>();
  const seenBarcode = new Set<string>();
  let warnCount = 0;

  lines.slice(1).forEach((line, i) => {
    const rowNum = i + 2;
    const cols = splitCsvLine(line);
    const name = (cols[idx.name] || "").trim();
    const category = (cols[idx.category] || "").trim();
    const price = Number((cols[idx.price] || "").trim());
    const stock = Number((cols[idx.stock] || "").trim());
    const description =
      idx.description >= 0 ? (cols[idx.description] || "").trim() : undefined;
    const sku = idx.sku >= 0 ? (cols[idx.sku] || "").trim() : undefined;
    const barcodeRaw =
      idx.barcode >= 0 ? (cols[idx.barcode] || "").trim() : undefined;
    const gtinRaw = idx.gtin >= 0 ? (cols[idx.gtin] || "").trim() : undefined;
    const code = barcodeRaw || gtinRaw || "";

    let ok = true;
    const warnings: string[] = [];

    if (!name) {
      errors.push({
        row: rowNum,
        field: "name",
        level: "error",
        message: "Name is required",
      });
      ok = false;
    } else if (name.length < 3) {
      warnings.push("Name is very short");
      warnCount += 1;
    }

    if (!category) {
      errors.push({
        row: rowNum,
        field: "category",
        level: "error",
        message: "Category is required",
      });
      ok = false;
    } else if (excluded.has(category.toLowerCase())) {
      errors.push({
        row: rowNum,
        field: "category",
        level: "error",
        message: `Category excluded from V1: ${category}`,
      });
      ok = false;
    } else if (!allowed.has(category.toLowerCase())) {
      errors.push({
        row: rowNum,
        field: "category",
        level: "error",
        message: `Not in V1 launch categories: ${category}`,
      });
      ok = false;
    }

    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
      errors.push({
        row: rowNum,
        field: "price",
        level: "error",
        message: "Price must be a non-negative integer (KES major units)",
      });
      ok = false;
    }

    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      errors.push({
        row: rowNum,
        field: "stock",
        level: "error",
        message: "Stock must be a non-negative integer",
      });
      ok = false;
    }

    if (sku) {
      if (seenSku.has(sku.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: "sku",
          level: "error",
          message: `Duplicate SKU in file: ${sku}`,
        });
        ok = false;
      } else {
        seenSku.add(sku.toLowerCase());
      }
    }

    let barcode: string | undefined;
    let gtin: string | undefined;
    if (code) {
      const v = validateGtin(code);
      if (!v.ok) {
        errors.push({
          row: rowNum,
          field: "barcode",
          level: "error",
          message: v.error || "Invalid barcode/GTIN",
        });
        ok = false;
      } else if (seenBarcode.has(v.digits)) {
        errors.push({
          row: rowNum,
          field: "barcode",
          level: "error",
          message: `Duplicate barcode in file: ${v.digits}`,
        });
        ok = false;
      } else {
        seenBarcode.add(v.digits);
        barcode = v.digits;
        gtin = v.digits;
      }
    } else {
      warnings.push("Missing barcode");
      warnCount += 1;
    }

    preview.push({
      row: rowNum,
      name: name || "(missing)",
      category: category || "(missing)",
      priceMajor: Number.isFinite(price) ? price : 0,
      stock: Number.isFinite(stock) ? stock : 0,
      sku,
      barcode,
      ok,
      warnings,
    });

    if (ok) {
      validRows.push({
        row: rowNum,
        name,
        category,
        priceMajor: price,
        stock,
        description: description || undefined,
        sku: sku || undefined,
        barcode,
        gtin,
      });
    }
  });

  const valid = preview.filter((p) => p.ok).length;
  return {
    errors,
    preview,
    validRows,
    summary: {
      rows: preview.length,
      valid,
      invalid: preview.length - valid,
      warnings: warnCount,
    },
  };
}
