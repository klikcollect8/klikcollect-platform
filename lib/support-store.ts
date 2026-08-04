import { promises as fs } from "fs";
import path from "path";
import { publicId } from "./ids";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = "support-tickets.json";

export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketType = "ticket" | "dispute";

export type SupportTicket = {
  id: string;
  type: TicketType;
  subject: string;
  body: string;
  status: TicketStatus;
  requesterEmail: string;
  /** Clerk user id when submitted from customer account. */
  clerkUserId?: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
  notes: string[];
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<SupportTicket[]> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const data = JSON.parse(raw) as SupportTicket[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeAll(tickets: SupportTicket[]): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, FILE),
    JSON.stringify(tickets, null, 2),
    "utf8",
  );
}

const STATUS_RANK: Record<TicketStatus, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
};

/** Queue order: oldest open first; resolved tickets last. */
export function sortTicketsForQueue(tickets: SupportTicket[]): SupportTicket[] {
  return [...tickets].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function listSupportTickets(filter?: {
  type?: TicketType;
  status?: TicketStatus;
}): Promise<SupportTicket[]> {
  let tickets = await readAll();
  if (filter?.type) {
    tickets = tickets.filter((t) => t.type === filter.type);
  }
  if (filter?.status) {
    tickets = tickets.filter((t) => t.status === filter.status);
  }
  return sortTicketsForQueue(tickets);
}

export async function getSupportTicket(
  id: string,
): Promise<SupportTicket | null> {
  const all = await readAll();
  return all.find((t) => t.id === id) ?? null;
}

export type CreateTicketInput = {
  subject: string;
  body: string;
  requesterEmail: string;
  clerkUserId?: string;
  orderId?: string;
  type?: TicketType;
};

export async function listSupportTicketsForUser(
  clerkUserId: string,
): Promise<SupportTicket[]> {
  const all = await readAll();
  return all
    .filter((t) => t.clerkUserId === clerkUserId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function createSupportTicket(
  input: CreateTicketInput,
): Promise<SupportTicket> {
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: publicId("tkt"),
    type: input.type ?? "ticket",
    subject: input.subject.trim(),
    body: input.body.trim(),
    status: "open",
    requesterEmail: input.requesterEmail.trim().toLowerCase(),
    clerkUserId: input.clerkUserId,
    orderId: input.orderId?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    notes: [],
  };
  const all = await readAll();
  all.push(ticket);
  await writeAll(all);
  return ticket;
}

export type UpdateTicketInput = {
  status?: TicketStatus;
  note?: string;
};

export async function updateSupportTicket(
  id: string,
  input: UpdateTicketInput,
): Promise<SupportTicket | null> {
  const all = await readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const ticket = { ...all[idx] };
  const now = new Date().toISOString();

  if (input.status) {
    ticket.status = input.status;
  }
  if (input.note?.trim()) {
    ticket.notes = [...ticket.notes, input.note.trim()];
  }
  ticket.updatedAt = now;
  all[idx] = ticket;
  await writeAll(all);
  return ticket;
}
