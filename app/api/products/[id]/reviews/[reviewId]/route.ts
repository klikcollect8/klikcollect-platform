import { NextRequest, NextResponse } from "next/server";
import { getAllReviews, updateProduct, softDeleteItem } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> },
) {
  try {
    const { id, reviewId } = await params;
    const supabase = await createClient();

    // Get review data before deleting
    const { data: reviewData, error: fetchError } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", reviewId)
      .single();

    if (fetchError || !reviewData) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Soft delete (store in bin)
    await softDeleteItem("review", reviewId, reviewData);

    // Actually delete review from Supabase
    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId);

    if (deleteError) {
      throw new Error(`Failed to delete review: ${deleteError.message}`);
    }

    // Update product rating
    const allReviews = await getAllReviews();
    const productReviews = allReviews.filter(
      (r: { productId: string }) => r.productId === id,
    );
    if (productReviews.length > 0) {
      const avgRating =
        productReviews.reduce((sum, r) => sum + r.rating, 0) /
        productReviews.length;
      await updateProduct(id, {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: productReviews.length,
      });
    } else {
      await updateProduct(id, {
        rating: undefined,
        reviewCount: 0,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete review" },
      { status: 500 },
    );
  }
}
