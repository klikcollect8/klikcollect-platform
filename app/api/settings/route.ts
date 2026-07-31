import { NextRequest, NextResponse } from "next/server";

const DEFAULT_SETTINGS = {
  siteName: "KlikCollect",
  siteDescription: "Order online and collect in store",
  contactEmail: "",
  contactPhone: "",
  address: "",
  socialFacebook: "",
  socialTwitter: "",
  socialInstagram: "",
  maintenanceMode: false,
};

export async function GET() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const query = supabase
      .from("settings")
      .select("value")
      .eq("key", "site_settings")
      .single();

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
    if (!data?.value) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }
    return NextResponse.json({ ...DEFAULT_SETTINGS, ...data.value });
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const updates = await request.json();

    const { data: existingData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "site_settings")
      .single();

    const currentSettings = existingData?.value || {};
    const newSettings = { ...currentSettings, ...updates };

    const { data, error } = await supabase
      .from("settings")
      .upsert(
        {
          key: "site_settings",
          value: newSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )
      .select("value")
      .single();

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }

    return NextResponse.json(data.value);
  } catch {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
