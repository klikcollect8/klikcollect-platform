import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  handleRequireAdminError,
  requireAdminPermission,
} from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireAdminPermission("products:manage_media");

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.",
        },
        { status: 400 },
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
    const fileExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(rawExt)
      ? rawExt === "jpeg"
        ? "jpg"
        : rawExt
      : "jpg";
    const fileName = `${timestamp}-${randomString}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Service role bypasses storage RLS (bucket only has public SELECT today).
    const { error } = await supabase.storage
      .from("product-images")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json(
        { error: `Failed to upload file: ${error.message}` },
        { status: 500 },
      );
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return handleRequireAdminError(error);
    }
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
