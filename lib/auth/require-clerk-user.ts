import { auth, currentUser, type User } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEmail } from "@/lib/admin-auth";

export type ClerkActor = {
  userId: string;
  user: User | null;
  email: string | null;
};

function claimEmail(claims: unknown): string | null {
  if (!claims || typeof claims !== "object") return null;
  const c = claims as Record<string, unknown>;
  if (typeof c.email === "string") return c.email;
  if (typeof c.email_address === "string") return c.email_address;
  const primary = c.primary_email_address;
  if (typeof primary === "string") return primary;
  return null;
}

/** Clerk authenticates the customer / vendor actor. Never hangs on Clerk API. */
export async function requireClerkUser(): Promise<ClerkActor | null> {
  try {
    const session = await auth();
    if (!session.userId) return null;

    let user: User | null = null;
    try {
      user = await Promise.race([
        currentUser(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
    } catch {
      user = null;
    }

    return {
      userId: session.userId,
      user,
      email:
        (user ? clerkEmail(user) : null) || claimEmail(session.sessionClaims),
    };
  } catch {
    return null;
  }
}

export function unauthorizedJson(message = "Sign in required") {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message } },
    { status: 401 },
  );
}

export function forbiddenJson(message = "Forbidden") {
  return NextResponse.json(
    { error: { code: "FORBIDDEN", message } },
    { status: 403 },
  );
}
