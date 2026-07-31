import { NextRequest, NextResponse } from "next/server";
import { addProduct } from "@/lib/data";
import { getUnifiedCatalogue } from "@/lib/commerce-truth";

export async function GET() {
  try {
    const unique = await getUnifiedCatalogue();
    return NextResponse.json(unique);
  } catch (error) {
    console.error("Error in products API:", error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      longDescription,
      price,
      image,
      images,
      category,
      stock,
      status,
      badges,
      rating,
      reviewCount,
      variations,
    } = body;

    if (
      !name ||
      !description ||
      price === undefined ||
      !image ||
      !category ||
      stock === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const product = await addProduct({
      name,
      description,
      longDescription,
      price: Number(price),
      image,
      images,
      category,
      stock: Number(stock),
      status: status || "published",
      badges,
      rating: rating ? Number(rating) : undefined,
      reviewCount: reviewCount ? Number(reviewCount) : undefined,
      variations,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  }
}
