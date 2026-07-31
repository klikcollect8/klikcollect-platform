import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, handleRequireAdminError } from "@/lib/auth/require-admin";
import {
  FEATURE_FLAG_KEYS,
  getFeatureFlags,
  setFeatureFlags,
  type FeatureFlagKey,
} from "@/lib/feature-flags";

export async function GET() {
  try {
    await requireAdmin();
    const flags = await getFeatureFlags();
    return NextResponse.json(flags);
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(["head_admin", "admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const updates: Partial<Record<FeatureFlagKey, boolean>> = {};

    for (const key of FEATURE_FLAG_KEYS) {
      if (typeof body[key] === "boolean") {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one boolean flag key" },
        { status: 400 },
      );
    }

    const flags = await setFeatureFlags(updates);
    return NextResponse.json(flags);
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
