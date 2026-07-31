import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface BannerSlideRow {
  id: string;
  title: string;
  subtitle?: string | null;
  cta_text: string;
  cta_link: string;
  image_url?: string | null;
  bg_color: string;
  text_color: string;
  enabled: boolean;
  display_order: number;
}

/**
 * GET /api/banner-slides
 * Get all enabled banner slides for public display
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("banner_slides")
      .select("*")
      .eq("enabled", true)
      .order("display_order", { ascending: true });

    // Missing table / RLS — soft empty so homepage uses local defaults.
    if (error || !data) {
      return NextResponse.json([]);
    }

    const rows = data as BannerSlideRow[];
    const slides = rows.map((slide) => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle,
      ctaText: slide.cta_text,
      ctaLink: slide.cta_link,
      imageUrl: slide.image_url,
      bgColor: slide.bg_color,
      textColor: slide.text_color,
      enabled: slide.enabled,
      displayOrder: slide.display_order,
    }));

    return NextResponse.json(slides);
  } catch {
    return NextResponse.json([]);
  }
}
