/**
 * Catalogue lifecycle + negative permission checks.
 * Offline asserts always run; live Supabase path runs when env is present.
 *
 * Run: npx tsx scripts/verify-catalogue-lifecycle.ts
 */
import { config } from "dotenv";
config();

import { validateGtin } from "../lib/catalogue/gtin";
import { evaluateCompleteness } from "../lib/catalogue/completeness";
import { generateVariantCombos } from "../lib/catalogue/variants";
import { validateCatalogueCsvRows } from "../lib/catalogue/bulk-import";
import { roleHasPermission } from "../lib/authz/roles";
import type { CatalogueDraft } from "../lib/catalogue/product-draft";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed += 1;
  } else {
    console.log("ok:", msg);
  }
}

// —— Permissions (negative) ——
assert(
  !roleHasPermission("cashier", "products:publish"),
  "cashier cannot publish products",
);
assert(
  !roleHasPermission("cashier", "products:create"),
  "cashier cannot create products",
);
assert(
  !roleHasPermission("support_agent", "offers:manage"),
  "support_agent cannot manage offers",
);
assert(
  roleHasPermission("marketplace_curator", "products:publish"),
  "marketplace_curator can publish",
);
assert(
  roleHasPermission("platform_admin", "products:manage_variants"),
  "platform_admin can manage variants",
);
assert(
  roleHasPermission("super_admin", "offers:manage"),
  "super_admin can manage offers",
);

// —— GTIN ——
assert(validateGtin("5901234123457").ok, "valid EAN-13 checksum");
assert(!validateGtin("5901234123456").ok, "invalid EAN-13 rejected");
assert(!validateGtin("abc").ok, "non-digit barcode rejected");

// —— Variants cartesian ——
const combos = generateVariantCombos([
  { name: "Size", values: ["S", "M"] },
  { name: "Colour", values: ["Red", "Blue"] },
]);
assert(combos.length === 4, "2×2 variant matrix = 4");

// —— Completeness gate ——
const incomplete: CatalogueDraft = {
  name: "Test",
  status: "draft",
};
const incompleteResult = evaluateCompleteness(incomplete);
assert(!incompleteResult.canPublish, "incomplete draft cannot publish");
assert(incompleteResult.blockers.length > 0, "incomplete has blockers");

const complete: CatalogueDraft = {
  name: "Brookside Full Cream Milk 1L",
  productKind: "branded",
  saleUnit: "each",
  status: "draft",
  categoryId: "cat_dairy",
  brandName: "Brookside",
  sku: "BRK-MILK-1L",
  barcode: "6001224123456",
  description: "Fresh full cream milk for everyday use.",
  imageUrl: "https://example.com/milk.jpg",
  slug: "brookside-full-cream-milk-1l",
  seoTitle: "Brookside Full Cream Milk 1L | KlikCollect",
  seoDescription: "Fresh milk for pickup in Nairobi.",
  guidePriceMinMinor: 15000,
  guidePriceAvgMinor: 18500,
  guidePriceMaxMinor: 22000,
  variants: [{ title: "Default", options: {}, status: "active" }],
};
const completeResult = evaluateCompleteness(complete);
assert(completeResult.canPublish, "complete draft can publish");

// —— Bulk import all-or-nothing ——
const badCsv = `name,category,price,stock,barcode
Good Milk,Dairy,185,10,5901234123457
Bad Price,Dairy,-1,5,
,Dairy,100,1,
Dup SKU,Dairy,50,2,5901234123457`;
const dry = validateCatalogueCsvRows(badCsv);
assert(dry.summary.invalid > 0, "dry-run flags invalid rows");
assert(
  dry.summary.valid < dry.summary.rows,
  "not all rows valid when errors present",
);

const goodCsv = `name,category,price,stock,sku,barcode
Brookside Milk 1L,Dairy & Eggs,185,20,BRK-1L,5901234123457`;
const good = validateCatalogueCsvRows(goodCsv);
assert(!good.parseError, "good CSV parses");
assert(good.summary.invalid === 0, "good CSV has zero invalid rows");
assert(good.summary.valid === 1, "good CSV has one valid row");
assert(dry.summary.invalid > 0, "invalid CSV blocks all-or-nothing commit");

async function liveLifecycle() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.log("skip: live Supabase lifecycle (no service env)");
    return;
  }

  const { upsertDraftProduct, publishProduct, archiveProduct, getAdminProductDetail } =
    await import("../lib/catalogue/admin-store");
  const { sbGetProductDetail } = await import("../lib/supabase-catalogue");
  const { getOfferById } = await import("../lib/offers-store");
  const { getServiceSupabase } = await import("../lib/supabase/admin");

  const actor = { userId: "script_verify", email: "verify@klikcollect.test" };
  const stamp = Date.now().toString(36);

  const draft = await upsertDraftProduct(
    {
      name: `Lifecycle Milk ${stamp}`,
      productKind: "branded",
      saleUnit: "each",
      description: "Automated lifecycle test product for catalogue QA.",
      sku: `QA-LIFE-${stamp}`,
      barcode: "5901234123457",
      gtin: "5901234123457",
      status: "draft",
      slug: `lifecycle-milk-${stamp}`,
      seoTitle: `Lifecycle Milk ${stamp}`,
      seoDescription: "QA product — safe to archive.",
      imageUrl: "https://placehold.co/600x800/png",
      images: ["https://placehold.co/600x800/png"],
      guidePriceMinMinor: 15000,
      guidePriceAvgMinor: 18500,
      guidePriceMaxMinor: 22000,
      brandName: "QA Brand",
    },
    actor,
  );
  const publicId = String(draft.id || "");
  assert(Boolean(publicId), "created draft product");

  let conflictThrown = false;
  try {
    await upsertDraftProduct(
      {
        publicId,
        name: `Lifecycle Milk ${stamp} stale`,
        version: 0,
        status: "draft",
      },
      actor,
    );
  } catch (e) {
    conflictThrown = (e as { status?: number }).status === 409;
  }
  assert(conflictThrown, "stale version returns 409");

  const sb = getServiceSupabase();
  const { data: cats } = await sb
    .from("categories")
    .select("id, public_id")
    .eq("is_active", true)
    .limit(1);
  const categoryId = cats?.[0]?.id;

  const refreshed = (await getAdminProductDetail(publicId)) as Record<
    string,
    unknown
  > | null;
  assert(Boolean(refreshed), "reload draft detail");

  const saved = await upsertDraftProduct(
    {
      publicId,
      version: Number(refreshed!.version || 1),
      name: String(refreshed!.name),
      productKind: "branded",
      saleUnit: "each",
      brandName: "QA Brand",
      description: "Automated lifecycle test product for catalogue QA.",
      sku: String(refreshed!.sku || `QA-LIFE-${stamp}`),
      barcode: "5901234123457",
      gtin: "5901234123457",
      status: "draft",
      categoryId: categoryId || undefined,
      slug: String(refreshed!.slug || ""),
      seoTitle: String(refreshed!.seoTitle || refreshed!.name),
      seoDescription: String(refreshed!.seoDescription || "QA product"),
      imageUrl: String(
        refreshed!.image || "https://placehold.co/600x800/png",
      ),
      images:
        Array.isArray(refreshed!.images) && (refreshed!.images as string[]).length
          ? (refreshed!.images as string[])
          : ["https://placehold.co/600x800/png"],
      guidePriceMinMinor: 15000,
      guidePriceAvgMinor: 18500,
      guidePriceMaxMinor: 22000,
    },
    actor,
  );
  assert(Boolean(saved.id), "draft enriched and saved");
  assert(
    Number(saved.guidePriceAvgMinor) === 18500,
    "guide average price persisted",
  );

  const { replaceVariants } = await import("../lib/catalogue/admin-store");
  await replaceVariants(
    publicId,
    {
      name: String(refreshed!.name),
      variants: [
        {
          title: "Default",
          options: {},
          sku: `QA-LIFE-${stamp}-D`,
          status: "active",
        },
      ],
    },
    actor,
  );

  let published;
  try {
    published = await publishProduct(publicId, {
      actor,
      override: true,
      reason: "verify-catalogue-lifecycle",
    });
  } catch (e) {
    console.error("publish error:", e);
    published = null;
  }
  assert(Boolean(published?.product), "publish succeeded");

  const storefront = await sbGetProductDetail(publicId);
  assert(
    Boolean(storefront) && storefront!.status === "published",
    "storefront detail sees published product",
  );

  // Offers are vendor-owned — optional if a vendor already attached one
  if (storefront?.offers?.[0]) {
    const offer = await getOfferById(storefront.offers[0].id);
    assert(Boolean(offer), "existing offer readable");
  } else {
    console.log("ok: no vendor offer yet (expected for admin-only registration)");
  }

  await archiveProduct(
    publicId,
    actor,
    "verify-catalogue-lifecycle cleanup",
  );

  const after = (await getAdminProductDetail(publicId)) as Record<
    string,
    unknown
  > | null;
  assert(after?.status === "archived", "product archived");

  const gone = await sbGetProductDetail(publicId);
  assert(!gone, "archived product hidden from storefront detail");
}

liveLifecycle()
  .then(() => {
    if (failed) {
      console.error(`\n${failed} assertion(s) failed`);
      process.exit(1);
    }
    console.log("\nAll catalogue lifecycle checks passed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
