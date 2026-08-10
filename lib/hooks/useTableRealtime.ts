"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Light postgres_changes subscription; falls back silently if channel unavailable. */
export function useTableRealtime(input: {
  channelName: string;
  table: string;
  filter?: string;
  onEvent: () => void;
  enabled?: boolean;
}) {
  const [channelOk, setChannelOk] = useState(false);
  const onEventRef = useRef(input.onEvent);
  onEventRef.current = input.onEvent;

  useEffect(() => {
    if (input.enabled === false) return;

    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;

    try {
      const sb = createClient();
      if (!sb?.channel) {
        setChannelOk(false);
        return;
      }

      channel = sb.channel(input.channelName);
      const cfg: {
        event: "*";
        schema: string;
        table: string;
        filter?: string;
      } = {
        event: "*",
        schema: "public",
        table: input.table,
      };
      if (input.filter) cfg.filter = input.filter;

      channel.on("postgres_changes", cfg, () => onEventRef.current());
      channel.subscribe((status: string) => {
        if (cancelled) return;
        setChannelOk(status === "SUBSCRIBED");
      });
    } catch {
      setChannelOk(false);
    }

    return () => {
      cancelled = true;
      try {
        if (channel) {
          const sb = createClient();
          void sb.removeChannel?.(channel);
        }
      } catch {
        /* ignore */
      }
    };
  }, [input.channelName, input.table, input.filter, input.enabled]);

  return { channelOk };
}
