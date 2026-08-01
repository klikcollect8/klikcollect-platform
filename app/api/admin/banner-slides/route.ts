import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, handleRequireAdminError } from "@/lib/auth/require-admin";

function mapSlide(slide: Record<string, unknown>) {
  return {
    id: slide.id,
    title: slide.headline || slide.title || "",
    subtitle: slide.sub || slide.subtitle || null,
    ctaText: slide.cta_label || slide.cta_text || "Shop now",
    ctaLink: slide.cta_href || slide.cta_link || "/shop",
    imageUrl: slide.image_url,
    eyebrow: slide.eyebrow,
    enabled: slide.is_active ?? slide.enabled ?? true,
    displayOrder: slide.sort_order ?? slide.display_order ?? 0,
    createdAt: slide.created_at,
  };
}

export async function GET() {
  try {
    await requireAdmin(["head_admin", "admin", "editor"]);
    const supabase = createAdminClient() || (await createClient());
    const { data, error } = await supabase
      .from("banner_slides")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch banner slides: ${error.message}`);
    }

    return NextResponse.json(
      (data || []).map((s: Record<string, unknown>) => mapSlide(s)),
    );
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 401 || err.status === 403) {
      return handleRequireAdminError(error) as NextResponse;
    }
    return NextResponse.json(
      { error: err.message || "Failed to fetch banner slides" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(["head_admin", "admin", "editor"]);
    const supabase = createAdminClient() || (await createClient());
    const body = await request.json();
    const {
      title,
      subtitle,
      ctaText,
      ctaLink,
      imageUrl,
      enabled,
      displayOrder,
      eyebrow,
    } = body;

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: "Title and image URL are required" },
        { status: 400 },
      );
    }

    let order = displayOrder;
    if (order === undefined || order === null) {
      const { data: maxSlide } = await supabase
        .from("banner_slides")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      order = maxSlide ? Number(maxSlide.sort_order || 0) + 1 : 0;
    }

    const { data, error } = await supabase
      .from("banner_slides")
      .insert({
        headline: title,
        sub: subtitle || null,
        eyebrow: eyebrow || null,
        cta_label: ctaText || "Shop now",
        cta_href: ctaLink || "/shop",
        image_url: imageUrl,
        is_active: enabled !== false,
        sort_order: order,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create banner slide: ${error.message}`);
    }

    return NextResponse.json(mapSlide(data as Record<string, unknown>), {
      status: 201,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 401 || err.status === 403) {
      return handleRequireAdminError(error) as NextResponse;
    }
    return NextResponse.json(
      { error: err.message || "Failed to create banner slide" },
      { status: 500 },
    );
  }
}
