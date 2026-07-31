import { NextRequest, NextResponse } from "next/server";
import { publicId } from "@/lib/ids";
import { appendUsageEvent, countUsageEvents, recentUsageEvents } from "@/lib/m1-store";

/**
 * Day-one instrumentation (M1 / FR-9).
 * North-star and usage events must emit from the first mile — cannot retrofit.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "Event name required" } },
        { status: 400 },
      );
    }

    const event = {
      id: publicId("evt"),
      name,
      properties: (body?.properties as Record<string, unknown>) || {},
      actorType: body?.actorType || "anonymous",
      createdAt: new Date().toISOString(),
    };

    await appendUsageEvent(event);
    return NextResponse.json({ data: event }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "WRITE_FAILED", message: "Could not record event" } },
      { status: 500 },
    );
  }
}

export async function GET() {
  const [count, recent] = await Promise.all([countUsageEvents(), recentUsageEvents(30)]);
  return NextResponse.json({ data: { count, recent } });
}
