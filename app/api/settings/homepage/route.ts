import { NextRequest, NextResponse } from "next/server";
import { HERO_COPY } from "@/lib/hero-assets";

const DEFAULT_SETTINGS = {
  bannerMessage: HERO_COPY.headline,
  bannerSubtitle: HERO_COPY.sub,
  bannerEnabled: true,
  bannerMessageSize: 1,
  bannerSubtitleSize: 1,
  bannerMessageSizes: { mobile: 1, tablet: 1, desktop: 1 },
  bannerSubtitleSizes: { mobile: 1, tablet: 1, desktop: 1 },
  eyebrow: HERO_COPY.eyebrow,
  headline: HERO_COPY.headline,
  sub: HERO_COPY.sub,
  cta: HERO_COPY.cta,
  ctaHref: HERO_COPY.ctaHref,
  heroImages: [] as string[],
  sections: [
    {
      id: "featured",
      type: "featured",
      title: "Featured Products",
      enabled: true,
      order: 1,
    },
    {
      id: "trending",
      type: "trending",
      title: "Trending Products",
      enabled: true,
      order: 2,
    },
  ],
};

function mapSettings(
  row: {
    settings?: Record<string, unknown> | null;
  } | null,
) {
  const s = (row?.settings || {}) as Record<string, unknown>;
  return {
    bannerMessage: String(
      s.headline || s.bannerMessage || DEFAULT_SETTINGS.bannerMessage,
    ),
    bannerSubtitle: String(
      s.sub || s.bannerSubtitle || DEFAULT_SETTINGS.bannerSubtitle,
    ),
    bannerEnabled: s.bannerEnabled !== false,
    bannerMessageSize: Number(s.bannerMessageSize || 1),
    bannerSubtitleSize: Number(s.bannerSubtitleSize || 1),
    bannerMessageSizes:
      (s.bannerMessageSizes as typeof DEFAULT_SETTINGS.bannerMessageSizes) ||
      DEFAULT_SETTINGS.bannerMessageSizes,
    bannerSubtitleSizes:
      (s.bannerSubtitleSizes as typeof DEFAULT_SETTINGS.bannerSubtitleSizes) ||
      DEFAULT_SETTINGS.bannerSubtitleSizes,
    eyebrow: String(s.eyebrow || DEFAULT_SETTINGS.eyebrow),
    headline: String(s.headline || DEFAULT_SETTINGS.headline),
    sub: String(s.sub || DEFAULT_SETTINGS.sub),
    cta: String(s.cta || DEFAULT_SETTINGS.cta),
    ctaHref: String(s.ctaHref || DEFAULT_SETTINGS.ctaHref),
    heroImages: Array.isArray(s.heroImages)
      ? s.heroImages.map(String)
      : DEFAULT_SETTINGS.heroImages,
    sections:
      Array.isArray(s.sections) && s.sections.length
        ? s.sections
        : DEFAULT_SETTINGS.sections,
  };
}

export async function GET() {
  try {
    const { createAdminClient, createClient } = await import(
      "@/lib/supabase/server"
    );
    const admin = createAdminClient();
    const supabase = admin || (await createClient());

    const { data } = await supabase
      .from("homepage_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    return NextResponse.json(mapSettings(data));
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { createAdminClient, createClient } = await import(
      "@/lib/supabase/server"
    );
    const admin = createAdminClient();
    const supabase = admin || (await createClient());
    const updates = await request.json();

    const { data: current } = await supabase
      .from("homepage_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();

    const prev = (current?.settings || {}) as Record<string, unknown>;
    const next = {
      ...prev,
      eyebrow: updates.eyebrow ?? prev.eyebrow,
      headline: updates.headline ?? updates.bannerMessage ?? prev.headline,
      sub: updates.sub ?? updates.bannerSubtitle ?? prev.sub,
      cta: updates.cta ?? prev.cta,
      ctaHref: updates.ctaHref ?? prev.ctaHref,
      heroImages: updates.heroImages ?? prev.heroImages,
      bannerEnabled: updates.bannerEnabled ?? prev.bannerEnabled,
      bannerMessageSize: updates.bannerMessageSize ?? prev.bannerMessageSize,
      bannerSubtitleSize: updates.bannerSubtitleSize ?? prev.bannerSubtitleSize,
      bannerMessageSizes: updates.bannerMessageSizes ?? prev.bannerMessageSizes,
      bannerSubtitleSizes:
        updates.bannerSubtitleSizes ?? prev.bannerSubtitleSizes,
      sections: updates.sections ?? prev.sections,
    };

    await supabase.from("homepage_settings").upsert({
      id: 1,
      settings: next,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json(mapSettings({ settings: next }));
  } catch {
    return NextResponse.json(
      { error: "Failed to update homepage settings" },
      { status: 500 },
    );
  }
}
