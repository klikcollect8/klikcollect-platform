"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/os/ModuleShell";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [rows, setRows] = useState<Note[]>([]);

  const load = () =>
    void fetch("/api/os/notifications")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/os/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <ModuleShell
      title="Notifications"
      description="Alerts for orders, payouts, reviews, and team activity."
      live
    >
      <div className="divide-y divide-black/[0.06] border-b border-black/10">
        {rows.map((n) => (
          <div
            key={n.id}
            className={cn(
              "flex items-start justify-between gap-4 py-4",
              !n.read_at && "text-black",
              n.read_at && "text-black/50",
            )}
          >
            <div className="min-w-0">
              {n.href ? (
                <Link
                  href={n.href}
                  onClick={() => {
                    if (!n.read_at) void markRead(n.id);
                  }}
                  className="text-[15px] font-medium hover:underline"
                >
                  {n.title}
                </Link>
              ) : (
                <p className="text-[15px] font-medium">{n.title}</p>
              )}
              {n.body ? (
                <p className={cn("mt-1 text-[13px]", osUi.muted)}>{n.body}</p>
              ) : null}
              <p className="mt-2 text-[11px] text-black/30">
                {new Date(n.created_at).toLocaleString("en-KE")}
              </p>
            </div>
            {!n.read_at ? (
              <button
                type="button"
                onClick={() => void markRead(n.id)}
                className={osUi.btnGhost}
              >
                Mark read
              </button>
            ) : (
              <span className="text-[11px] uppercase tracking-wider text-black/30">
                Read
              </span>
            )}
          </div>
        ))}
        {!rows.length ? (
          <p className={cn("py-10 text-center text-[14px]", osUi.muted)}>
            No notifications yet - new orders, payouts, and unanswered questions
            show up here.
          </p>
        ) : null}
      </div>
    </ModuleShell>
  );
}
