import { NextRequest, NextResponse } from "next/server";

const DEFAULT_SETTINGS = {
  bannerMessage: "Shop Smart, Collect Fast",
  bannerSubtitle: "Premium products, convenient pickup",
  bannerEnabled: true,
  bannerMessageSize: 1,
  bannerSubtitleSize: 1,
  bannerMessageSizes: { mobile: 1, tablet: 1, desktop: 1 },
  bannerSubtitleSizes: { mobile: 1, tablet: 1, desktop: 1 },
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

export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const query = supabase.from("homepage_settings").select("*").single();
    const result = await Promise.race([
      query,
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: "timeout" } }),
          2000,
        ),
      ),
    ]);

    const data = result && "data" in result ? result.data : null;
    if (!data) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json({
      bannerMessage: data.banner_message ?? DEFAULT_SETTINGS.bannerMessage,
      bannerSubtitle: data.banner_subtitle ?? DEFAULT_SETTINGS.bannerSubtitle,
      bannerEnabled: data.banner_enabled ?? true,
      bannerMessageSize: Number(data.banner_message_size || 1),
      bannerSubtitleSize: Number(data.banner_subtitle_size || 1),
      bannerMessageSizes:
        data.banner_message_sizes || DEFAULT_SETTINGS.bannerMessageSizes,
      bannerSubtitleSizes:
        data.banner_subtitle_sizes || DEFAULT_SETTINGS.bannerSubtitleSizes,
      sections: data.sections?.length ? data.sections : DEFAULT_SETTINGS.sections,
    });
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const updates = await request.json();

    const { data: currentData } = await supabase
      .from("homepage_settings")
      .select("*")
      .single();

    const currentSettings = currentData || {};

    const newSettings = {
      banner_message:
        updates.bannerMessage !== undefined
          ? updates.bannerMessage
          : currentSettings.banner_message,
      banner_subtitle:
        updates.bannerSubtitle !== undefined
          ? updates.bannerSubtitle
          : currentSettings.banner_subtitle,
      banner_enabled:
        updates.bannerEnabled !== undefined
          ? updates.bannerEnabled
          : currentSettings.banner_enabled,
      banner_message_size:
        updates.bannerMessageSize !== undefined
          ? updates.bannerMessageSize
          : currentSettings.banner_message_size,
      banner_subtitle_size:
        updates.bannerSubtitleSize !== undefined
          ? updates.bannerSubtitleSize
          : currentSettings.banner_subtitle_size,
      banner_message_sizes:
        updates.bannerMessageSizes ||
        currentSettings.banner_message_sizes ||
        DEFAULT_SETTINGS.bannerMessageSizes,
      banner_subtitle_sizes:
        updates.bannerSubtitleSizes ||
        currentSettings.banner_subtitle_sizes ||
        DEFAULT_SETTINGS.bannerSubtitleSizes,
      sections: updates.sections || currentSettings.sections || [],
      updated_at: new Date().toISOString(),
    };

    if (currentData?.id) {
      await supabase
        .from("homepage_settings")
        .update(newSettings)
        .eq("id", currentData.id);
    } else {
      await supabase.from("homepage_settings").insert(newSettings);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update homepage settings" },
      { status: 500 },
    );
  }
}
