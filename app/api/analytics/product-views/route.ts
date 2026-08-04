import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { productId, action } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Get user if authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Track the view/click
    const { error } = await supabase.from("product_analytics").insert({
      product_id: productId,
      user_id: user?.id || null,
      action: action || "view", // 'view', 'click', 'add_to_cart', 'purchase'
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
      user_agent: request.headers.get("user-agent") || "unknown",
      created_at: new Date().toISOString(),
    });

    if (error) {
      // If table doesn't exist, return success anyway (graceful degradation)
      console.error("Analytics tracking error:", error);
      return NextResponse.json({
        success: true,
        note: "Tracking table not configured",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking product analytics:", error);
    return NextResponse.json({ success: true }); // Don't fail the request
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const days = parseInt(searchParams.get("days") || "30");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from("product_analytics")
      .select("*")
      .gte("created_at", startDate.toISOString());

    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      // Return empty data if table doesn't exist
      return NextResponse.json({ data: [], views: 0, clicks: 0, purchases: 0 });
    }

    const views =
      data?.filter((a: { action: string }) => a.action === "view").length || 0;
    const clicks =
      data?.filter((a: { action: string }) => a.action === "click").length || 0;
    const purchases =
      data?.filter((a: { action: string }) => a.action === "purchase").length ||
      0;

    return NextResponse.json({
      data: data || [],
      views,
      clicks,
      purchases,
      total: data?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ data: [], views: 0, clicks: 0, purchases: 0 });
  }
}
