"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OS_NAV_GROUPS, osNav } from "@/components/os/nav";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

/** Modules shown in the More hub (everything except primary tabs). */
const MORE_HREFS = new Set([
  "/app/inventory",
  "/app/pos",
  "/app/orders/packing",
  "/app/store",
  "/app/store/hours",
  "/app/branches",
  "/app/questions",
  "/app/reviews",
  "/app/staff",
  "/app/finance",
  "/app/notifications",
  "/app/settings",
]);

export default function MoreHubPage() {
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/os/me")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled || !body?.data) return;
        setPermissions(
          Array.isArray(body.data.permissions) ? body.data.permissions : [],
        );
      })
      .catch(() => {
        if (!cancelled) setPermissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/os/questions")
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/os/notifications")
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([questionsRes, notifRes]) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      const questions = questionsRes?.data?.questions;
      if (Array.isArray(questions)) {
        next["/app/questions"] = questions.filter(
          (q: { answers?: unknown[] }) => !(q.answers || []).length,
        ).length;
      }
      const notifs = notifRes?.data;
      if (Array.isArray(notifs)) {
        next["/app/notifications"] = notifs.filter(
          (n: { read_at?: string | null }) => !n.read_at,
        ).length;
      }
      setCounts(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    return osNav.filter((item) => {
      if (!MORE_HREFS.has(item.href)) return false;
      if (!item.permission) return true;
      if (permissions === null) return item.live !== false;
      return permissions.includes(item.permission);
    });
  }, [permissions]);

  return (
    <ModuleShell
      title="More"
      description="Stock, fulfilment, store, team, and money — everything outside the main tabs."
      live
    >
      <div className="space-y-10">
        {OS_NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group.id);
          if (!groupItems.length) return null;
          return (
            <section key={group.id}>
              <p className={cn(osUi.sectionLabel, "mb-3")}>{group.label}</p>
              <ul className="divide-y divide-black/10 border-y border-black/10">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const count = counts[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex min-h-14 items-center gap-3 py-3.5 transition-opacity hover:opacity-60"
                      >
                        <Icon
                          className="h-5 w-5 shrink-0 text-black/35"
                          strokeWidth={1.5}
                        />
                        <span className="min-w-0 flex-1 truncate text-[16px] font-medium tracking-tight text-black">
                          {item.label}
                        </span>
                        {typeof count === "number" && count > 0 ? (
                          <span className={osUi.badge}>{count}</span>
                        ) : null}
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-black/25"
                          strokeWidth={1.5}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </ModuleShell>
  );
}
