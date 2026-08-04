import type { Metadata } from "next";
import { messages } from "@/messages/en-KE";

/** OS pages read live Supabase catalogue - never static-prerender at build. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: messages.os.title,
  description: "Vendor and platform operations for KlikCollect - Nairobi, KES.",
};

export default function OsSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
