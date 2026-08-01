/**
 * One-shot: clear boutique commerce seed, upload images, upsert Nairobi grocery catalogue.
 * Usage: npx tsx scripts/seed-supabase-catalogue.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { V1_CATEGORIES } from "../lib/curation-policy";
import { FOUNDING_VENDORS, vendorForCategory } from "../lib/founding-vendors";
import { majorToMinor } from "../lib/money";
import { HERO_COPY, HERO_SEED_FILES } from "../lib/hero-assets";
import catalogue from "./seed-catalogue.json";

const SEED_ASSETS = path.join(process.cwd(), "scripts", "seed-assets");

async function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), file), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        if (process.env[m[1]]) continue;
        let val = m[2];
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        process.env[m[1]] = val;
      }
    } catch {
      /* optional */
    }
  }
}

type CatalogueRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceMajor: number;
  image: string;
  slug: string;
};

const SECONDARY_BY_CATEGORY: Record<string, string> = {
  "Fresh Produce": "ven_everyday_basket",
  "Dairy & Eggs": "ven_everyday_basket",
  Pantry: "ven_everyday_basket",
  Beverages: "ven_sip_house",
  Snacks: "ven_crunch_corner",
  Groceries: "ven_home_staples",
  "General Essentials": "ven_clean_living",
  "Household Essentials": "ven_home_staples",
  "Home & Kitchen": "ven_home_staples",
  "Health & Wellness (non-prescription)": "ven_home_staples",
};

const CATEGORY_FILES: Record<string, string> = {
  Groceries: "groceries.jpeg",
  "General Essentials": "general-essentials.jpeg",
  "Fresh Produce": "fresh-produce.jpeg",
  Pantry: "pantry.jpeg",
  "Dairy & Eggs": "dairy-eggs.jpeg",
  Beverages: "beverages.jpeg",
  "Household Essentials": "household-essentials.jpeg",
  Snacks: "snacks.jpeg",
  "Home & Kitchen": "home-kitchen.jpeg",
  "Health & Wellness (non-prescription)": "health-wellness.jpeg",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeDemoGtin(index: number): string {
  const base = `62910415${String(1000 + index).slice(-4)}`;
  let sum = 0;
  const reversed = base.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    const n = Number(reversed[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + String(check);
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function uploadFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  bucket: string,
  objectPath: string,
  filePath: string,
  contentType: string,
): Promise<string> {
  const body = await fs.readFile(filePath);
  const { error } = await sb.storage.from(bucket).upload(objectPath, body, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload ${bucket}/${objectPath}: ${error.message}`);
  const { data } = sb.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function main() {
  await loadEnvFiles();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const root = process.cwd();
  const products = catalogue as CatalogueRow[];

  console.log("Clearing previous commerce seed…");
  await sb.from("product_offers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("product_variants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("stores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("curation_decisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("curation_applications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("vendors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("banner_slides").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  console.log("Uploading category images…");
  const categoryImageUrls: Record<string, string> = {};
  for (const name of V1_CATEGORIES) {
    const file = CATEGORY_FILES[name];
    if (!file) continue;
    const fp = path.join(SEED_ASSETS, "categories", file);
    try {
      categoryImageUrls[name] = await uploadFile(
        sb,
        "category-images",
        file,
        fp,
        "image/jpeg",
      );
    } catch (e) {
      console.warn(`Category image skip ${name}:`, e);
    }
  }

  console.log("Upserting categories…");
  const categoryIdByName = new Map<string, string>();
  for (let i = 0; i < V1_CATEGORIES.length; i++) {
    const name = V1_CATEGORIES[i];
    const slug = slugify(name);
    const { data, error } = await sb
      .from("categories")
      .upsert(
        {
          slug,
          name,
          description: `${name} on KlikCollect`,
          sort_order: i,
          image_url: categoryImageUrls[name] || null,
          is_active: true,
          public_id: `cat_${slug}`,
        },
        { onConflict: "slug" },
      )
      .select("id, name")
      .single();
    if (error) throw error;
    categoryIdByName.set(data.name, data.id);
  }

  console.log("Upserting vendors + stores…");
  const vendorUuidByPublicId = new Map<string, string>();
  const storeUuidByVendorPublicId = new Map<string, string>();
  for (const v of FOUNDING_VENDORS) {
    const { data: vendor, error } = await sb
      .from("vendors")
      .upsert(
        {
          public_id: v.id,
          slug: v.slug,
          name: v.name,
          tagline: v.tagline,
          description: v.tagline,
          status: "admitted",
          city: "Nairobi",
          neighbourhood: v.neighbourhood,
          contact_email: v.email,
          specialty: v.specialty,
          address_text: v.address,
        },
        { onConflict: "public_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    vendorUuidByPublicId.set(v.id, vendor.id);

    const { data: store, error: sErr } = await sb
      .from("stores")
      .insert({
        public_id: `sto_${v.slug}`,
        vendor_id: vendor.id,
        name: `${v.name} pickup`,
        neighbourhood: v.neighbourhood,
        address_text: v.address,
        lat: v.lat,
        lng: v.lng,
        is_primary: true,
      })
      .select("id")
      .single();
    if (sErr) throw sErr;
    storeUuidByVendorPublicId.set(v.id, store.id);

    await sb.from("curation_applications").insert({
      public_id: `cap_${v.slug}`,
      vendor_id: vendor.id,
      status: "decided",
      pitch: v.tagline,
    });
  }

  console.log("Uploading product images + upserting products…");
  const productUuidByPublicId = new Map<string, string>();
  const productImageCache = new Map<string, string>();

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const fileName = path.basename(p.image);
    let imageUrl = productImageCache.get(fileName);
    if (!imageUrl) {
      const fp = path.join(SEED_ASSETS, "products", fileName);
      try {
        imageUrl = await uploadFile(sb, "product-images", fileName, fp, "image/jpeg");
        productImageCache.set(fileName, imageUrl);
      } catch {
        imageUrl = p.image; // fallback to relative path if missing
      }
    }

    const { data, error } = await sb
      .from("products")
      .upsert(
        {
          public_id: p.id,
          vendor_id: null,
          category_id: categoryIdByName.get(p.category) || null,
          name: p.name,
          slug: p.slug || slugify(p.name),
          description: p.description,
          long_description: p.description,
          status: "published",
          image_url: imageUrl,
          images: [imageUrl],
          rating: 4.4 + (i % 5) * 0.1,
          review_count: 8 + i * 2,
        },
        { onConflict: "public_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    productUuidByPublicId.set(p.id, data.id);
    if ((i + 1) % 20 === 0) console.log(`  products ${i + 1}/${products.length}`);
  }

  console.log("Creating offers…");
  const offerRows: Record<string, unknown>[] = [];
  let offerIndex = 0;
  products.forEach((p, i) => {
    const primary = vendorForCategory(p.category);
    if (!primary) return;
    const productUuid = productUuidByPublicId.get(p.id);
    const vendorUuid = vendorUuidByPublicId.get(primary.id);
    if (!productUuid || !vendorUuid) return;

    const barcode = makeDemoGtin(offerIndex++);
    offerRows.push({
      public_id: `off_${p.id}_${primary.id}`,
      product_id: productUuid,
      vendor_id: vendorUuid,
      store_id: storeUuidByVendorPublicId.get(primary.id) || null,
      price_minor: majorToMinor(p.priceMajor),
      currency_code: "KES",
      on_hand: 20 + (i % 40),
      reserved: 0,
      status: "published",
      barcode,
      gtin: barcode,
    });

    const secondaryId = SECONDARY_BY_CATEGORY[p.category];
    if (secondaryId && secondaryId !== primary.id && i % 3 === 0) {
      const secondaryUuid = vendorUuidByPublicId.get(secondaryId);
      if (!secondaryUuid) return;
      const delta = i % 2 === 0 ? -40 : 60;
      const barcode2 = makeDemoGtin(offerIndex++);
      offerRows.push({
        public_id: `off_${p.id}_${secondaryId}`,
        product_id: productUuid,
        vendor_id: secondaryUuid,
        store_id: storeUuidByVendorPublicId.get(secondaryId) || null,
        price_minor: majorToMinor(Math.max(50, p.priceMajor + delta)),
        currency_code: "KES",
        on_hand: 12 + (i % 18),
        reserved: 0,
        status: "published",
        barcode: barcode2,
        gtin: barcode2,
      });
    }
  });

  // Upsert in chunks
  for (let i = 0; i < offerRows.length; i += 50) {
    const chunk = offerRows.slice(i, i + 50);
    const { error } = await sb.from("product_offers").upsert(chunk, {
      onConflict: "public_id",
    });
    if (error) throw error;
  }

  console.log("Seeding homepage CMS…");
  const heroUrls: string[] = [];
  for (const fileName of HERO_SEED_FILES) {
    const fp = path.join(SEED_ASSETS, "hero", fileName);
    try {
      heroUrls.push(
        await uploadFile(sb, "cms-images", `hero/${fileName}`, fp, "image/jpeg"),
      );
    } catch (e) {
      console.warn(`Hero image skip ${fileName}:`, e);
    }
  }

  await sb.from("homepage_settings").upsert({
    id: 1,
    settings: {
      eyebrow: HERO_COPY.eyebrow,
      headline: HERO_COPY.headline,
      sub: HERO_COPY.sub,
      cta: HERO_COPY.cta,
      ctaHref: HERO_COPY.ctaHref,
      heroImages: heroUrls,
    },
    updated_at: new Date().toISOString(),
  });

  const slides = heroUrls.slice(0, 5).map((image_url, sort_order) => ({
    sort_order,
    image_url,
    eyebrow: HERO_COPY.eyebrow,
    headline: HERO_COPY.headline,
    sub: HERO_COPY.sub,
    cta_label: HERO_COPY.cta,
    cta_href: HERO_COPY.ctaHref,
    is_active: true,
  }));
  if (slides.length) {
    const { error } = await sb.from("banner_slides").insert(slides);
    if (error) throw error;
  }

  console.log("Done.", {
    categories: V1_CATEGORIES.length,
    vendors: FOUNDING_VENDORS.length,
    products: products.length,
    offers: offerRows.length,
    heroImages: heroUrls.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
