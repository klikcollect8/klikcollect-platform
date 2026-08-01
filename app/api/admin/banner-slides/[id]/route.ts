import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, handleRequireAdminError } from "@/lib/auth/require-admin";

function mapSlide(data: Record<string, unknown>) {
  return {
    id: data.id,
    title: data.headline || data.title || "",
    subtitle: data.sub || data.subtitle || null,
    ctaText: data.cta_label || data.cta_text || "Shop now",
    ctaLink: data.cta_href || data.cta_link || "/shop",
    imageUrl: data.image_url,
    eyebrow: data.eyebrow,
    enabled: data.is_active ?? data.enabled ?? true,
    displayOrder: data.sort_order ?? data.display_order ?? 0,
    createdAt: data.created_at,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(["head_admin", "admin", "editor"]);
    const { id } = await params;
    const supabase = createAdminClient() || (await createClient());

    const { data, error } = await supabase
      .from("banner_slides")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Banner slide not found" }, { status: 404 });
    }

    return NextResponse.json(mapSlide(data as Record<string, unknown>));
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(["head_admin", "admin", "editor"]);
    const { id: slideId } = await params;

    if (!slideId || slideId === "undefined" || slideId === "null") {
      return NextResponse.json({ error: "Invalid slide ID provided" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.headline = body.title;
    if (body.subtitle !== undefined) updateData.sub = body.subtitle || null;
    if (body.eyebrow !== undefined) updateData.eyebrow = body.eyebrow;
    if (body.ctaText !== undefined) updateData.cta_label = body.ctaText;
    if (body.ctaLink !== undefined) updateData.cta_href = body.ctaLink;
    if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl || null;
    if (body.enabled !== undefined) updateData.is_active = body.enabled;
    if (body.displayOrder !== undefined) updateData.sort_order = body.displayOrder;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = createAdminClient() || (await createClient());
    const { data, error } = await supabase
      .from("banner_slides")
      .update(updateData)
      .eq("id", slideId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to update banner slide" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    return NextResponse.json(mapSlide(data as Record<string, unknown>));
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(["head_admin", "admin", "editor"]);
    const { id } = await params;
    const supabase = createAdminClient() || (await createClient());

    const { error } = await supabase.from("banner_slides").delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete banner slide: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
