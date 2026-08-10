"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type Answer = {
  id: string;
  userName: string;
  answer: string;
  createdAt: string;
};

type Question = {
  id: string;
  productId: string;
  userName: string;
  question: string;
  answers: Answer[];
  createdAt: string;
};

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params?.id || ""));
  const [vendorId, setVendorId] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [productName, setProductName] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [reportMessage, setReportMessage] = useState("");
  const [missing, setMissing] = useState(false);

  const load = (vid: string) =>
    void fetch(`/api/os/questions?vendorId=${encodeURIComponent(vid)}`)
      .then((r) => r.json())
      .then((j) => {
        const q = ((j.data?.questions || []) as Question[]).find(
          (x) => x.id === id,
        );
        if (!q) {
          setMissing(true);
          return;
        }
        setQuestion(q);
        const p = (j.data?.products || []).find(
          (x: { publicId: string }) => x.publicId === q.productId,
        );
        setProductName(p?.name || q.productId);
      });

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const vid = b?.data?.vendorIds?.[0] || "";
        setVendorId(vid);
        if (vid) load(vid);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function postAnswer() {
    if (!question || !reply.trim() || !vendorId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/os/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          questionId: question.id,
          answer: reply.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.error?.message || "Failed to post");
        return;
      }
      setReply("");
      setStatus("Answer posted");
      load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  async function removeAnswer(answerId: string) {
    if (!vendorId) return;
    setBusy(true);
    await fetch("/api/os/questions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId, answerId }),
    });
    setBusy(false);
    load(vendorId);
  }

  async function reportQuestion() {
    if (!question || !vendorId) return;
    setBusy(true);
    const res = await fetch("/api/os/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "report",
        vendorId,
        questionId: question.id,
        reason: reportReason,
        message: reportMessage,
      }),
    });
    setBusy(false);
    setStatus(res.ok ? "Report sent" : "Report failed");
    setReportOpen(false);
  }

  if (missing) {
    return (
      <div className="space-y-6 py-10 text-center">
        <p className="font-medium">Question not found</p>
        <Link href="/app/questions" className={osUi.btnSecondary}>
          Back
        </Link>
      </div>
    );
  }

  if (!question) {
    return (
      <p className="py-16 text-center text-[14px] text-black/40">Loading…</p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-28">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.push("/app/questions")}
          className="mt-0.5 flex h-11 w-11 items-center justify-center text-black/50"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <div className="min-w-0">
          <p className={osUi.pageEyebrow}>Question</p>
          <h1 className="mt-1 text-[22px] font-medium leading-snug tracking-tight sm:text-[26px]">
            {question.question}
          </h1>
          <p className="mt-2 text-[13px] text-black/40">
            {question.userName} · {productName}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <p className={osUi.sectionLabel}>Answers</p>
        <div className="divide-y divide-black/10 border-y border-black/10">
          {(question.answers || []).length === 0 ? (
            <p className={cn("py-6 text-[13px]", osUi.muted)}>
              Waiting for your reply.
            </p>
          ) : (
            (question.answers || []).map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{a.userName}</p>
                  <p className="mt-0.5 text-[14px] text-black/60">{a.answer}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeAnswer(a.id)}
                  className={osUi.btnGhost}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <label className="block">
        <span className={osUi.sectionLabel}>Answer as store</span>
        <textarea
          className={cn(osUi.input, "mt-1 min-h-[100px] resize-y")}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Helpful, specific answer…"
        />
      </label>

      {reportOpen ? (
        <div className="space-y-3 border border-black/10 p-4">
          <p className={osUi.sectionLabel}>Report to KlikCollect</p>
          <select
            className={osUi.input}
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
          >
            <option value="inappropriate">Inappropriate</option>
            <option value="spam">Spam</option>
            <option value="inaccurate">Inaccurate</option>
            <option value="abuse">Abuse</option>
            <option value="other">Other</option>
          </select>
          <textarea
            className={cn(osUi.input, "min-h-[80px] resize-y")}
            value={reportMessage}
            onChange={(e) => setReportMessage(e.target.value)}
            placeholder="What should moderators know?"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void reportQuestion()}
              className={osUi.btnPrimary}
            >
              Send report
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className={osUi.btnGhost}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {status ? <p className="text-[13px] text-black/50">{status}</p> : null}

      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-black/10 bg-[var(--kc-canvas)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-0">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button
            type="button"
            disabled={busy || !reply.trim()}
            onClick={() => void postAnswer()}
            className={cn(osUi.btnPrimary, "min-h-12 flex-1")}
          >
            Post answer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setReportOpen((v) => !v)}
            className={cn(osUi.btnSecondary, "min-h-12")}
          >
            Report
          </button>
        </div>
      </div>
    </div>
  );
}
