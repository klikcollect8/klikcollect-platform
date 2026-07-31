import { NextResponse } from "next/server";
import {
  requireClerkUser,
  unauthorizedJson,
} from "@/lib/auth/require-clerk-user";
import {
  createSupportTicket,
  listSupportTicketsForUser,
} from "@/lib/support-store";

export async function GET() {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();
  const tickets = await listSupportTicketsForUser(actor.userId);
  return NextResponse.json(
    tickets.map((t) => ({
      id: t.id,
      user_id: t.clerkUserId,
      email: t.requesterEmail,
      subject: t.subject,
      message: t.body,
      status: t.status,
      created_at: t.createdAt,
    })),
  );
}

export async function POST(request: Request) {
  const actor = await requireClerkUser();
  if (!actor) return unauthorizedJson();

  const body = await request.json();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const email = String(body.email || actor.email || "").trim();

  if (!subject || !message) {
    return NextResponse.json(
      { error: "Subject and message are required" },
      { status: 400 },
    );
  }

  const ticket = await createSupportTicket({
    subject,
    body: message,
    requesterEmail: email,
    clerkUserId: actor.userId,
    orderId: body.orderId ? String(body.orderId) : undefined,
  });

  return NextResponse.json(
    {
      id: ticket.id,
      user_id: ticket.clerkUserId,
      email: ticket.requesterEmail,
      subject: ticket.subject,
      message: ticket.body,
      status: ticket.status,
      created_at: ticket.createdAt,
    },
    { status: 201 },
  );
}
