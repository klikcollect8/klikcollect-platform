import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  requireAdmin,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdmin(["super_admin"]);
    const supabase = createAdminClient() || (await createClient());

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: "userId and action are required" },
        { status: 400 },
      );
    }

    // Prevent self-management
    if (userId === user.id) {
      return NextResponse.json(
        { error: "You cannot perform this action on yourself" },
        { status: 400 },
      );
    }

    // Get target user's profile to check role
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent managing other head_admins
    if (targetProfile.role === "super_admin") {
      return NextResponse.json(
        { error: "Cannot manage other Head Administrators" },
        { status: 403 },
      );
    }

    let result;

    switch (action) {
      case "delete":
        // Delete user from auth and profile
        const { error: deleteAuthError } =
          await supabase.auth.admin.deleteUser(userId);
        if (deleteAuthError) {
          return NextResponse.json(
            { error: deleteAuthError.message || "Failed to delete user" },
            { status: 500 },
          );
        }
        // Profile will be deleted via cascade or trigger
        result = { success: true, message: "User deleted successfully" };
        break;

      case "disable":
        // Update profile status to disabled
        const { error: disableError } = await supabase
          .from("profiles")
          .update({ status: "disabled", updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (disableError) {
          return NextResponse.json(
            { error: disableError.message || "Failed to disable user" },
            { status: 500 },
          );
        }
        result = { success: true, message: "User disabled successfully" };
        break;

      case "ban":
        // Update profile status to banned
        const { error: banError } = await supabase
          .from("profiles")
          .update({ status: "banned", updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (banError) {
          return NextResponse.json(
            { error: banError.message || "Failed to ban user" },
            { status: 500 },
          );
        }
        result = { success: true, message: "User banned successfully" };
        break;

      case "enable":
        // Update profile status to active
        const { error: enableError } = await supabase
          .from("profiles")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (enableError) {
          return NextResponse.json(
            { error: enableError.message || "Failed to enable user" },
            { status: 500 },
          );
        }
        result = { success: true, message: "User enabled successfully" };
        break;

      case "warn":
        // Increment warnings count
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("warnings")
          .eq("id", userId)
          .single();

        const currentWarnings = currentProfile?.warnings || 0;
        const { error: warnError } = await supabase
          .from("profiles")
          .update({
            warnings: currentWarnings + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (warnError) {
          return NextResponse.json(
            { error: warnError.message || "Failed to warn user" },
            { status: 500 },
          );
        }
        result = {
          success: true,
          message: `User warned successfully. Total warnings: ${currentWarnings + 1}`,
        };
        break;

      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Allowed actions: delete, disable, ban, enable, warn",
          },
          { status: 400 },
        );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error managing user:", error);
    return handleRequireAdminError(error);
  }
}
