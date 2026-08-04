"use client";

import { useUser } from "@clerk/nextjs";

interface LogActivityParams {
  type:
    | "product"
    | "order"
    | "review"
    | "question"
    | "login"
    | "logout"
    | "settings"
    | "category"
    | "homepage";
  action: string;
  description: string;
  link?: string;
  metadata?: unknown;
}

/**
 * Admin activity log - posts to /api/events (M1 instrumentation).
 * No longer writes via Supabase Auth.
 */
export function useActivityLog() {
  const { user } = useUser();

  const logActivity = async (params: LogActivityParams) => {
    if (!user?.id) return;
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `admin.${params.type}.${params.action}`,
          properties: {
            description: params.description,
            link: params.link,
            metadata: params.metadata || {},
          },
        }),
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  return { logActivity };
}
