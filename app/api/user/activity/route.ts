import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import { appendActivity, listActivity } from "@/lib/customer-store";

export async function POST(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const { activity_type, activity_data } = await request.json();
  if (!activity_type) {
    return NextResponse.json({ error: "Missing activity_type" }, { status: 400 });
  }

  const data = await appendActivity(
    actor.userId,
    String(activity_type),
    activity_data || {},
  );
  return NextResponse.json(data);
}

export async function GET(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const activity_type = searchParams.get("activity_type");

  let rows = await listActivity(actor.userId);
  if (activity_type) {
    rows = rows.filter((r) => r.activity_type === activity_type);
  }
  return NextResponse.json(rows.slice(0, limit));
}
