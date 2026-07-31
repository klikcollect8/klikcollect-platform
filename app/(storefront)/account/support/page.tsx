"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useToast } from "@/components/ToastProvider";
import { ui } from "@/components/system/tokens";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  created_at: string;
};

export default function AccountSupportPage() {
  const { user } = useUserAuth();
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = () => {
    fetch("/api/support/tickets")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTickets(Array.isArray(data) ? data : []))
      .catch(() => setTickets([]));
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      showToast("Add a subject and message", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          email: user?.email,
        }),
      });
      if (!res.ok) {
        showToast("Could not send message", "error");
        return;
      }
      setSubject("");
      setMessage("");
      showToast("Message sent — we will reply by email", "success");
      loadTickets();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <p className={ui.pageEyebrow}>Account</p>
        <h1 className={`mt-3 ${ui.pageTitle}`}>Support</h1>
        <p className={cn("mt-2", ui.pageDesc)}>
          Questions about pickup, payments, or your account? We are here to help.
        </p>
      </div>

      <section className={cn(ui.panel, "p-4")}>
        <p className="text-[13px] text-[var(--kc-mute)]">
          Browse quick answers on our{" "}
          <Link href="/customer-service" className="font-medium text-[var(--kc-ink)] hover:underline">
            customer service hub
          </Link>
          , or email{" "}
          <a href="mailto:support@klikcollect.co.ke" className="font-medium text-[var(--kc-ink)] hover:underline">
            support@klikcollect.co.ke
          </a>
          .
        </p>
      </section>

      <section className={ui.panel}>
        <div className="border-b border-[var(--kc-line-soft)] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[var(--kc-ink)]">Send a message</h2>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--kc-mute)]">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={cn("w-full", ui.input)}
              placeholder="Order pickup, refund, etc."
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--kc-mute)]">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className={cn("w-full resize-y", ui.input)}
              placeholder="Tell us what you need…"
            />
          </label>
          <button type="submit" disabled={submitting} className={ui.btnPrimary}>
            {submitting ? "Sending…" : "Submit ticket"}
          </button>
        </form>
      </section>

      {tickets.length > 0 ? (
        <section className={ui.panel}>
          <div className="border-b border-[var(--kc-line-soft)] px-4 py-3">
            <h2 className="text-[14px] font-semibold text-[var(--kc-ink)]">Your recent tickets</h2>
          </div>
          <ul className="divide-y divide-[var(--kc-line-soft)]">
            {tickets.slice(0, 5).map((t) => (
              <li key={t.id} className="px-4 py-3">
                <p className="text-[13px] font-medium text-[var(--kc-ink)]">{t.subject}</p>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--kc-mute)]">{t.message}</p>
                <p className="mt-1 text-[11px] text-[var(--kc-faint)]">
                  {format(new Date(t.created_at), "MMM d, yyyy · h:mm a")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
