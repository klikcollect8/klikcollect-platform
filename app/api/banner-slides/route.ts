import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/banner-slides
 * Active CMS banner slides (Supabase).
 */
export async function GET() {
  try {
    const admin = createAdminClient();
    const supabase = admin || (await createClient());
    const { data, error } = await supabase
      .from("banner_slides")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data) {
      return NextResponse.json([], {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      });
    }

    const slides = data.map((slide: Record<string, unknown>) => ({
      id: slide.id,
      title: String(slide.headline || ""),
      subtitle: slide.sub,
      ctaText: String(slide.cta_label || "Shop now"),
      ctaLink: String(slide.cta_href || "/shop"),
      imageUrl: slide.image_url,
      eyebrow: slide.eyebrow,
      headline: slide.headline,
      sub: slide.sub,
      enabled: slide.is_active,
      displayOrder: slide.sort_order,
    }));

    return NextResponse.json(slides, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json([]);
  }
}
