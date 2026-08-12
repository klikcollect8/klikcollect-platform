import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  distanceMeters,
  isInKenyaBbox,
  isSuspiciousCoordinate,
  isValidLatLng,
} from "@/lib/location/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUPLICATE_RADIUS_M = 30;
const LOW_CONFIDENCE = new Set(["low", "manual"]);

type BranchRow = {
  id: string;
  public_id: string | null;
  name: string;
  vendor_id: string | null;
  neighbourhood: string | null;
  address_text: string | null;
  lat: number | null;
  lng: number | null;
  location_verified: boolean | null;
  location_confidence: string | null;
  location_updated_at: string | null;
};

type BranchIssue = {
  id: string;
  publicId: string | null;
  name: string;
  vendorId: string | null;
  vendorName: string | null;
  lat: number | null;
  lng: number | null;
  neighbourhood: string | null;
  address: string | null;
  verified: boolean;
  confidence: string | null;
  updatedAt: string | null;
  issues: string[];
};

export async function GET() {
  try {
    await requireAdminPermission("vendors:view");
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: err.status || 401 },
    );
  }

  const sb = getServiceSupabase();

  const [branchesRes, correctionsRes, ordersRes] = await Promise.all([
    sb
      .from("stores")
      .select(
        "id, public_id, name, vendor_id, neighbourhood, address_text, lat, lng, location_verified, location_confidence, location_updated_at",
      )
      .limit(1000),
    sb
      .from("location_corrections")
      .select(
        "id, context, provider_lat, provider_lng, corrected_lat, corrected_lng, provider_label, place_id, distance_m, clerk_user_id, store_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("orders")
      .select(
        "public_id, order_number, delivery_lat, delivery_lng, delivery_confidence, delivery_landmark, created_at",
      )
      .not("delivery_lat", "is", null)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (branchesRes.error) {
    return NextResponse.json(
      { error: branchesRes.error.message },
      { status: 500 },
    );
  }

  const branches = (branchesRes.data || []) as BranchRow[];

  // Vendor names for display
  const vendorIds = [
    ...new Set(branches.map((b) => b.vendor_id).filter(Boolean)),
  ] as string[];
  const vendorNames = new Map<string, string>();
  if (vendorIds.length) {
    const { data: vendors } = await sb
      .from("vendors")
      .select("id, name")
      .in("id", vendorIds);
    for (const v of vendors || []) {
      vendorNames.set(String(v.id), String(v.name));
    }
  }

  const toIssue = (b: BranchRow, issues: string[]): BranchIssue => ({
    id: b.id,
    publicId: b.public_id,
    name: b.name,
    vendorId: b.vendor_id,
    vendorName: b.vendor_id ? vendorNames.get(b.vendor_id) || null : null,
    lat: b.lat,
    lng: b.lng,
    neighbourhood: b.neighbourhood,
    address: b.address_text,
    verified: !!b.location_verified,
    confidence: b.location_confidence,
    updatedAt: b.location_updated_at,
    issues,
  });

  const missing: BranchIssue[] = [];
  const suspicious: BranchIssue[] = [];
  const unverified: BranchIssue[] = [];
  const duplicates: BranchIssue[] = [];

  const withCoords = branches.filter(
    (b) => b.lat != null && b.lng != null && isValidLatLng(b.lat, b.lng),
  );

  for (const b of branches) {
    const hasCoords =
      b.lat != null && b.lng != null && isValidLatLng(b.lat, b.lng);
    if (!hasCoords) {
      missing.push(toIssue(b, ["No coordinates"]));
      continue;
    }
    const lat = b.lat as number;
    const lng = b.lng as number;
    const issues: string[] = [];
    if (isSuspiciousCoordinate(lat, lng)) {
      issues.push("Placeholder-looking coordinates (0,0 / default centre)");
    } else if (!isInKenyaBbox(lat, lng)) {
      issues.push("Outside Kenya");
    }
    if (issues.length) {
      suspicious.push(toIssue(b, issues));
      continue;
    }
    if (!b.location_verified) {
      unverified.push(toIssue(b, ["Pin never confirmed on a map"]));
    }
  }

  // Near-duplicate pins within the same vendor
  const byVendor = new Map<string, BranchRow[]>();
  for (const b of withCoords) {
    if (!b.vendor_id) continue;
    const list = byVendor.get(b.vendor_id) || [];
    list.push(b);
    byVendor.set(b.vendor_id, list);
  }
  const dupSeen = new Set<string>();
  for (const list of byVendor.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const d = distanceMeters(
          a.lat as number,
          a.lng as number,
          b.lat as number,
          b.lng as number,
        );
        if (d >= DUPLICATE_RADIUS_M) continue;
        for (const [row, other] of [
          [a, b],
          [b, a],
        ] as const) {
          if (dupSeen.has(row.id)) continue;
          dupSeen.add(row.id);
          duplicates.push(
            toIssue(row, [
              `Within ${Math.round(d)} m of "${other.name}" (same vendor)`,
            ]),
          );
        }
      }
    }
  }

  const corrections = (correctionsRes.data || []).map((c) => ({
    id: String(c.id),
    context: String(c.context),
    providerLat: Number(c.provider_lat),
    providerLng: Number(c.provider_lng),
    correctedLat: Number(c.corrected_lat),
    correctedLng: Number(c.corrected_lng),
    providerLabel: c.provider_label ? String(c.provider_label) : null,
    placeId: c.place_id ? String(c.place_id) : null,
    distanceM: Number(c.distance_m || 0),
    storeId: c.store_id ? String(c.store_id) : null,
    createdAt: String(c.created_at),
  }));

  const lowConfidenceOrders = (ordersRes.data || [])
    .filter((o) => {
      const conf = o.delivery_confidence
        ? String(o.delivery_confidence)
        : null;
      const lat = Number(o.delivery_lat);
      const lng = Number(o.delivery_lng);
      return (
        (conf && LOW_CONFIDENCE.has(conf)) ||
        !isValidLatLng(lat, lng) ||
        isSuspiciousCoordinate(lat, lng) ||
        !isInKenyaBbox(lat, lng)
      );
    })
    .slice(0, 100)
    .map((o) => ({
      orderId: String(o.public_id),
      orderNumber: o.order_number ? String(o.order_number) : null,
      lat: Number(o.delivery_lat),
      lng: Number(o.delivery_lng),
      confidence: o.delivery_confidence
        ? String(o.delivery_confidence)
        : null,
      landmark: o.delivery_landmark ? String(o.delivery_landmark) : null,
      createdAt: String(o.created_at),
    }));

  return NextResponse.json({
    kpis: {
      branches: branches.length,
      missing: missing.length,
      suspicious: suspicious.length,
      unverified: unverified.length,
      duplicates: duplicates.length,
      corrections30d: corrections.filter(
        (c) =>
          Date.now() - new Date(c.createdAt).getTime() <
          30 * 24 * 60 * 60 * 1000,
      ).length,
      lowConfidenceOrders: lowConfidenceOrders.length,
    },
    branches: { missing, suspicious, unverified, duplicates },
    corrections,
    lowConfidenceOrders,
  });
}
