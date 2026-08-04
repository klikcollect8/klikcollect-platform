/**
 * Apply founding multi-branch stores + hours to the live DB (service role).
 * Usage: npx tsx scripts/apply-founding-branches.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { FOUNDING_VENDORS, foundingVendorStores } from "../lib/founding-vendors";

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

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing ${key}`);
  return v;
}

async function main() {
  await loadEnvFiles();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let storesUpserted = 0;
  let hoursRows = 0;

  for (const v of FOUNDING_VENDORS) {
    const { data: vendor, error: vErr } = await sb
      .from("vendors")
      .select("id")
      .eq("public_id", v.id)
      .maybeSingle();
    if (vErr) throw vErr;
    if (!vendor) {
      console.warn(`skip missing vendor ${v.id}`);
      continue;
    }

    for (const s of foundingVendorStores(v)) {
      if (s.isPrimary) {
        const { error } = await sb
          .from("stores")
          .update({
            name: s.name,
            neighbourhood: s.neighbourhood,
            address_text: s.address,
            lat: s.lat,
            lng: s.lng,
          })
          .eq("public_id", s.publicId);
        if (error) throw error;
      } else {
        const { data: existing } = await sb
          .from("stores")
          .select("id")
          .eq("public_id", s.publicId)
          .maybeSingle();
        if (!existing) {
          const { error } = await sb.from("stores").insert({
            public_id: s.publicId,
            vendor_id: vendor.id,
            name: s.name,
            neighbourhood: s.neighbourhood,
            address_text: s.address,
            lat: s.lat,
            lng: s.lng,
            phone: s.phone,
            is_primary: false,
          });
          if (error) throw error;
        } else {
          const { error } = await sb
            .from("stores")
            .update({
              name: s.name,
              neighbourhood: s.neighbourhood,
              address_text: s.address,
              lat: s.lat,
              lng: s.lng,
              phone: s.phone,
              is_primary: false,
            })
            .eq("public_id", s.publicId);
          if (error) throw error;
        }
      }
      storesUpserted += 1;

      await sb.from("store_hours").delete().eq("store_public_id", s.publicId);

      const hourRows = [0, 1, 2, 3, 4, 5, 6].map((day) => {
        const isSunday = day === 0;
        const isSaturday = day === 6;
        const satellite = !s.isPrimary;
        return {
          store_public_id: s.publicId,
          vendor_public_id: v.id,
          day_of_week: day,
          open_time: isSunday
            ? null
            : satellite && isSaturday
              ? "10:00"
              : "09:00",
          close_time: isSunday
            ? null
            : satellite
              ? isSaturday
                ? "16:00"
                : "17:30"
              : isSaturday
                ? "17:00"
                : "18:00",
          is_closed: isSunday,
        };
      });
      const { error: hErr } = await sb.from("store_hours").insert(hourRows);
      if (hErr) throw hErr;
      hoursRows += hourRows.length;
    }
    console.log(`✓ ${v.slug} (${foundingVendorStores(v).length} stores)`);
  }

  console.log(`Done. stores=${storesUpserted} hour_rows=${hoursRows}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
