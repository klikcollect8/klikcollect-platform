import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  handleRequireAdminError,
} from "@/lib/auth/require-admin";
import {
  createSupportTicket,
  listSupportTickets,
  type TicketType,
} from "@/lib/support-store";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const typeParam = request.nextUrl.searchParams.get("type");
    const type =
      typeParam === "ticket" || typeParam === "dispute"
        ? (typeParam as TicketType)
        : undefined;
    const tickets = await listSupportTickets(type ? { type } : undefined);
    return NextResponse.json(tickets);
  } catch (error) {
    return handleRequireAdminError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const payload = await request.json();
    const {
      subject,
      body: ticketBody,
      requesterEmail,
      orderId,
      type,
    } = payload as {
      subject?: string;
      body?: string;
      requesterEmail?: string;
      orderId?: string;
      type?: TicketType;
    };

    if (!subject?.trim() || !ticketBody?.trim() || !requesterEmail?.trim()) {
      return NextResponse.json(
        { error: "subject, body, and requesterEmail are required" },
        { status: 400 },
      );
    }

    const ticket = await createSupportTicket({
      subject,
      body: ticketBody,
      requesterEmail,
      orderId,
      type: type === "dispute" ? "dispute" : "ticket",
    });
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    return handleRequireAdminError(error);
  }
}
