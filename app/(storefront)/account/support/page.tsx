"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useToast } from "@/components/ToastProvider";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  created_at: string;
};

const fieldClass =
  "h-auto w-full border-0 border-b border-black/15 bg-transparent px-0 py-3 text-[15px] text-black outline-none placeholder:text-black/30 focus:border-black/50";
const labelClass =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-black/35";

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
      showToast("Message sent - we will reply by email", "success");
      loadTickets();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 text-left">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Support
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-black/45">
          Questions about pickup, payments, or your account? We are here to
          help.
        </p>
      </div>

      <p className="text-[14px] leading-relaxed text-black/45">
        Browse quick answers on our{" "}
        <Link
          href="/customer-service"
          className="text-[13px] text-black/40 underline decoration-black/20 underline-offset-[5px] hover:text-black hover:decoration-black"
        >
          customer service hub
        </Link>
        , or email{" "}
        <a
          href="mailto:support@klikcollect.co.ke"
          className="text-[13px] text-black/40 underline decoration-black/20 underline-offset-[5px] hover:text-black hover:decoration-black"
        >
          support@klikcollect.co.ke
        </a>
        .
      </p>

      <section>
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
          Send a message
        </h2>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-5">
          <label className="block text-left">
            <span className={labelClass}>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={fieldClass}
              placeholder="Order pickup, refund, etc."
            />
          </label>
          <label className="block text-left">
            <span className={labelClass}>Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className={`${fieldClass} resize-y`}
              placeholder="Tell us what you need…"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center bg-black text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {submitting ? "Sending…" : "Submit ticket"}
          </button>
        </form>
      </section>

      {tickets.length > 0 ? (
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-black/35">
            Recent tickets
          </h2>
          <ul className="mt-2">
            {tickets.slice(0, 5).map((t) => (
              <li
                key={t.id}
                className="border-b border-black/[0.08] py-4 text-left"
              >
                <p className="text-[15px] font-medium text-black">
                  {t.subject}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[13px] text-black/35">
                  {t.message}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-black/25">
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
