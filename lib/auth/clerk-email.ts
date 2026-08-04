import type { User } from "@clerk/nextjs/server";

export function clerkEmail(user: User): string | null {
  return (
    user.primaryEmailAddress?.emailAddress?.toLowerCase() ||
    user.emailAddresses[0]?.emailAddress?.toLowerCase() ||
    null
  );
}
