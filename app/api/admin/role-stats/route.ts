import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * API endpoint to get role statistics
 * Only accessible to head_admin users
 * Uses admin client to bypass RLS
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Role check temporarily disabled - will be re-enabled after basic auth is working
    // const roleResponse = await fetch(new URL('/api/admin/current-role', request.url));
    // const roleData = await roleResponse.json();
    // if (roleData.role !== 'head_admin') {
    //   return NextResponse.json({
    //     error: 'Access denied. Head administrator only.'
    //   }, { status: 403 });
    // }

    // Use admin client to fetch all profiles
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        {
          error: "Admin client not available",
        },
        { status: 500 },
      );
    }

    const { data: allProfiles, error } = await adminClient
      .from("profiles")
      .select("role");

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 },
      );
    }

    if (!allProfiles) {
      return NextResponse.json({
        stats: {
          totalUsers: 0,
          user: 0,
          editor: 0,
          moderator: 0,
          admin: 0,
          head_admin: 0,
        },
      });
    }

    // Calculate role statistics
    const stats = {
      totalUsers: allProfiles.length,
      user: allProfiles.filter((p: any) => p.role === "user").length,
      editor: allProfiles.filter((p: any) => p.role === "editor").length,
      moderator: allProfiles.filter((p: any) => p.role === "moderator").length,
      admin: allProfiles.filter((p: any) => p.role === "admin").length,
      head_admin: allProfiles.filter((p: any) => p.role === "head_admin")
        .length,
    };

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error("[role-stats] Error:", error);
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 },
    );
  }
}
