import { NextRequest, NextResponse } from "next/server";
import { getUnifiedCatalogue } from "@/lib/commerce-truth";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { categoryImage } from "@/lib/category-images";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!query) {
    return NextResponse.json({ products: [], categories: [] });
  }

  try {
    const queryLower = query.toLowerCase();
    const products = await getUnifiedCatalogue();

    const matchedProducts = products
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(queryLower) ||
          p.category?.toLowerCase().includes(queryLower) ||
          p.description?.toLowerCase().includes(queryLower),
      )
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(queryLower);
        const bStarts = b.name.toLowerCase().startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      })
      .slice(0, 40);

    const matchedCategories = V1_CATEGORIES.filter((name) =>
      name.toLowerCase().includes(queryLower),
    ).map((name, i) => ({
      id: `cat_${i}`,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: "",
      image: categoryImage(name) || "",
    }));

    return NextResponse.json({
      products: matchedProducts,
      categories: matchedCategories,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 },
    );
  }
}
