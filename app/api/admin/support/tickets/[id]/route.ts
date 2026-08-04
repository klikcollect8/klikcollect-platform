import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import {
  getSupportTicket,
  updateSupportTicket,
  type TicketStatus,
} from "@/lib/support-store";

const STATUSES: TicketStatus[] = ["open", "in_progress", "resolved"];

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const existing = await getSupportTicket(id);
    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const body = await request.json();
    const { status, note } = body as { status?: TicketStatus; note?: string };

    if (status && !STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    if (!status && !note?.trim()) {
      return NextResponse.json(
        { error: "Provide status and/or note to update" },
        { status: 400 },
      );
    }

    const updated = await updateSupportTicket(id, { status, note });
    return NextResponse.json(updated);
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
