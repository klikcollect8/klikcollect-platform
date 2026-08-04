import { NextRequest, NextResponse } from "next/server";
import { requireVendorPermission } from "@/lib/auth/require-vendor";
import { inVendorScope, vendorScopeIds } from "@/lib/auth/vendor-scope";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { emitVendorActivity } from "@/lib/vendor-activity";

export async function GET(request: NextRequest) {
  const vendorId = request.nextUrl.searchParams.get("vendorId") || undefined;
  const gate = await requireVendorPermission("vendor:settings", { vendorId });
  if (!gate.ok) return gate.response;

  const scope = vendorId || vendorScopeIds(gate.actor)[0];
  if (!scope || !inVendorScope(gate.actor, scope)) {
    return NextResponse.json({ data: null });
  }

  const sb = getServiceSupabase();
  const [{ data: vendor }, { data: profile }] = await Promise.all([
    sb.from("vendors").select("*").eq("public_id", scope).maybeSingle(),
    sb
      .from("vendor_profiles")
      .select("*")
      .eq("vendor_public_id", scope)
      .maybeSingle(),
  ]);

  const policies = (profile?.policies || {}) as Record<string, unknown>;
  const storefrontRaw =
    policies.storefront && typeof policies.storefront === "object"
      ? (policies.storefront as Record<string, unknown>)
      : {};

  return NextResponse.json({
    data: {
      vendorPublicId: scope,
      slug: vendor?.slug || "",
      name: profile?.display_name || vendor?.name || "",
      description: profile?.description || vendor?.description || "",
      story: profile?.story || "",
      logoUrl: profile?.logo_url || vendor?.logo_url || "",
      bannerUrl: profile?.banner_url || vendor?.cover_url || "",
      themeColor: profile?.theme_color || "",
      contactEmail: profile?.contact_email || vendor?.contact_email || "",
      contactPhone: profile?.contact_phone || vendor?.contact_phone || "",
      whatsapp: profile?.whatsapp || "",
      socials: profile?.socials || {},
      policies: {
        returns: typeof policies.returns === "string" ? policies.returns : "",
        storefront: {
          announcement:
            typeof storefrontRaw.announcement === "string"
              ? storefrontRaw.announcement
              : "",
          highlight:
            typeof storefrontRaw.highlight === "string"
              ? storefrontRaw.highlight
              : "",
          featuredCategory:
            typeof storefrontRaw.featuredCategory === "string"
              ? storefrontRaw.featuredCategory
              : "",
          showReviews: storefrontRaw.showReviews !== false,
          showLocations: storefrontRaw.showLocations !== false,
          showHours: storefrontRaw.showHours !== false,
          showStory: storefrontRaw.showStory !== false,
        },
      },
      city: vendor?.city || "",
      neighbourhood: vendor?.neighbourhood || "",
      addressText: vendor?.address_text || "",
    },
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const vendorId = String(body?.vendorId || "");
  const gate = await requireVendorPermission("vendor:settings", { vendorId });
  if (!gate.ok) return gate.response;
  if (!inVendorScope(gate.actor, vendorId)) {
    return NextResponse.json(
      { error: { message: "Vendor out of scope" } },
      { status: 403 },
    );
  }

  const sb = getServiceSupabase();
  const now = new Date().toISOString();
  const profileRow = {
    vendor_public_id: vendorId,
    display_name: body?.name != null ? String(body.name) : undefined,
    description:
      body?.description != null ? String(body.description) : undefined,
    story: body?.story != null ? String(body.story) : undefined,
    logo_url: body?.logoUrl != null ? String(body.logoUrl) : undefined,
    banner_url: body?.bannerUrl != null ? String(body.bannerUrl) : undefined,
    theme_color: body?.themeColor != null ? String(body.themeColor) : undefined,
    contact_email:
      body?.contactEmail != null ? String(body.contactEmail) : undefined,
    contact_phone:
      body?.contactPhone != null ? String(body.contactPhone) : undefined,
    whatsapp: body?.whatsapp != null ? String(body.whatsapp) : undefined,
    socials: body?.socials ?? undefined,
    policies: body?.policies ?? undefined,
    updated_at: now,
  };

  const clean = Object.fromEntries(
    Object.entries(profileRow).filter(([, v]) => v !== undefined),
  );

  const { data: existing } = await sb
    .from("vendor_profiles")
    .select("id")
    .eq("vendor_public_id", vendorId)
    .maybeSingle();

  let profile;
  if (existing) {
    const { data, error } = await sb
      .from("vendor_profiles")
      .update(clean)
      .eq("vendor_public_id", vendorId)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }
    profile = data;
  } else {
    const { data, error } = await sb
      .from("vendor_profiles")
      .insert({ ...clean, vendor_public_id: vendorId })
      .select("*")
      .single();
    if (error) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 },
      );
    }
    profile = data;
  }

  const vendorPatch: Record<string, unknown> = { updated_at: now };
  if (body?.name != null) vendorPatch.name = String(body.name);
  if (body?.description != null)
    vendorPatch.description = String(body.description);
  if (body?.logoUrl != null) vendorPatch.logo_url = String(body.logoUrl);
  if (body?.bannerUrl != null) vendorPatch.cover_url = String(body.bannerUrl);
  if (body?.contactEmail != null)
    vendorPatch.contact_email = String(body.contactEmail);
  if (body?.contactPhone != null)
    vendorPatch.contact_phone = String(body.contactPhone);

  await sb.from("vendors").update(vendorPatch).eq("public_id", vendorId);

  await emitVendorActivity({
    vendorPublicId: vendorId,
    kind: "system",
    title: "Store profile updated",
    body: body?.name ? String(body.name) : undefined,
    refType: "vendor_profile",
    refId: vendorId,
  });

  return NextResponse.json({ data: profile });
}
