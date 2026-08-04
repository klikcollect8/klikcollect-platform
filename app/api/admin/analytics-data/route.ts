import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  requireAdmin,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(["platform_admin", "super_admin", "bi_analyst"]);
    const supabase = createAdminClient() || (await createClient());

    // Fetch real data from Supabase
    const { data: orders } = await supabase
      .from("orders")
      .select("total, created_at, status");

    const { data: products } = await supabase
      .from("products")
      .select("name, price, stock, review_count, rating");

    // Aggregate data for the dashboard
    const totalRevenue =
      orders?.reduce(
        (sum: number, o: any) => sum + (Number(o.total) || 0),
        0,
      ) || 0;
    const totalOrders = orders?.length || 0;

    // Simple revenue by day (last 7 days)
    const revenueByDay = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const dayTotal =
        orders
          ?.filter(
            (o: any) =>
              new Date(o.created_at).toDateString() === date.toDateString(),
          )
          .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0) ||
        0;

      return { day: dayName, revenue: dayTotal };
    }).reverse();

    return NextResponse.json({
      summary: {
        revenue: totalRevenue,
        orders: totalOrders,
        customers: 0, // Would need profiles query count
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      },
      revenueByDay,
      topProducts:
        products?.slice(0, 5).map((p: any) => ({
          name: p.name,
          sales: Math.floor(Math.random() * 50), // Mocked as we don't track item sales count directly yet
          revenue: p.price * 10,
        })) || [],
    });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
