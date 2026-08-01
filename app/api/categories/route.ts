import { NextRequest, NextResponse } from "next/server";
import { sbListCategories } from "@/lib/supabase-catalogue";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { Category } from "@/types";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const categories = await sbListCategories();
    const search = request.nextUrl.searchParams.get("search");
    let filtered = categories;
    if (search) {
      const q = search.toLowerCase();
      filtered = categories.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q),
      );
    }
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("GET /api/categories", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, image } = body;
    if (!name) {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }
    const sb = getServiceSupabase();
    const slug = generateSlug(name);
    const { data, error } = await sb
      .from("categories")
      .insert({
        name,
        slug,
        description: description || null,
        image_url: image || null,
        public_id: `cat_${slug}`,
        is_active: true,
      })
      .select("*")
      .single();
    if (error) throw error;
    const category: Category = {
      id: data.public_id,
      name: data.name,
      slug: data.slug,
      description: data.description || undefined,
      image: data.image_url || undefined,
      productCount: 0,
    };
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("POST /api/categories", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 },
    );
  }
}
