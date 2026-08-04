"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ModuleShell } from "@/components/os/ModuleShell";
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

type ProductRef = { publicId: string; name: string; imageUrl: string | null };

export default function OsQuestionsPage() {
  const [vendorId, setVendorId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "answered" | "unanswered"
  >("all");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = (vid?: string) =>
    void fetch(
      vid
        ? `/api/os/questions?vendorId=${encodeURIComponent(vid)}`
        : "/api/os/questions",
    )
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message || "Failed to load");
        else {
          setError(null);
          setQuestions(j.data?.questions || []);
          setProducts(j.data?.products || []);
        }
      });

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const id = b?.data?.vendorIds?.[0] || "";
        setVendorId(id);
        load(id || undefined);
      });
  }, []);

  const productName = (id: string) =>
    products.find((p) => p.publicId === id)?.name || id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions.filter((item) => {
      if (filterProduct !== "all" && item.productId !== filterProduct)
        return false;
      const answered = (item.answers || []).length > 0;
      if (filterStatus === "answered" && !answered) return false;
      if (filterStatus === "unanswered" && answered) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.userName.toLowerCase().includes(q) ||
        productName(item.productId).toLowerCase().includes(q)
      );
    });
  }, [questions, products, filterProduct, filterStatus, query]);

  const selected = questions.find((q) => q.id === selectedId) || null;
  const unanswered = questions.filter((q) => !(q.answers || []).length).length;

  async function postAnswer() {
    if (!selected || !reply.trim() || !vendorId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/os/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          questionId: selected.id,
          answer: reply.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.error?.message || "Answer failed");
        return;
      }
      setReply("");
      setStatus("Answer posted");
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion() {
    if (!selected || !vendorId) return;
    if (!window.confirm("Remove this question from your storefront?")) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/os/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, questionId: selected.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.error?.message || "Delete failed");
        return;
      }
      setSelectedId(null);
      setStatus("Question removed");
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  async function removeAnswer(answerId: string) {
    if (!selected || !vendorId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/os/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          questionId: selected.id,
          answerId,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setStatus(j.error?.message || "Failed to remove answer");
        return;
      }
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleShell
      title="Questions"
      description="Answer shoppers asking about products you sell. Unanswered items stay visible until you reply."
      live
    >
      {error ? (
        <p className={cn("mb-4 text-[13px]", osUi.danger)}>{error}</p>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-[180px] flex-1">
          <span className={osUi.sectionLabel}>Search</span>
          <input
            className={osUi.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Question, customer, product…"
          />
        </label>
        <label className="min-w-[140px]">
          <span className={osUi.sectionLabel}>Product</span>
          <select
            className={osUi.input}
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
          >
            <option value="all">All</option>
            {products.map((p) => (
              <option key={p.publicId} value={p.publicId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[140px]">
          <span className={osUi.sectionLabel}>Status</span>
          <select
            className={osUi.input}
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(
                e.target.value as "all" | "answered" | "unanswered",
              )
            }
          >
            <option value="all">All</option>
            <option value="unanswered">Unanswered ({unanswered})</option>
            <option value="answered">Answered</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="divide-y divide-black/[0.06] border-b border-black/10">
          <div className="flex items-baseline justify-between pb-3">
            <p className={osUi.sectionLabel}>{filtered.length} questions</p>
          </div>
          {!filtered.length ? (
            <p className={cn("py-10 text-[14px]", osUi.muted)}>
              No questions on your catalogue yet.
            </p>
          ) : null}
          {filtered.map((item) => {
            const answered = (item.answers || []).length > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setReply("");
                  setStatus(null);
                }}
                className={cn(
                  "flex w-full items-start justify-between gap-3 py-3.5 text-left transition-colors",
                  selectedId === item.id
                    ? "text-black"
                    : "text-black/55 hover:text-black",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">
                    {item.question}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-black/40">
                    {productName(item.productId)} · {item.userName}
                    {answered ? "" : " · Needs answer"}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] text-black/35">
                  {formatDistanceToNow(new Date(item.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </button>
            );
          })}
        </div>

        <aside className="space-y-5 border-t border-black/10 pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          {!selected ? (
            <p className={cn("text-[14px]", osUi.muted)}>
              Select a question to answer or remove.
            </p>
          ) : (
            <>
              <div>
                <p className={osUi.sectionLabel}>Question</p>
                <p className="mt-2 text-[18px] font-medium tracking-tight leading-snug">
                  {selected.question}
                </p>
                <p className="mt-1 text-[13px] text-black/40">
                  {selected.userName} · {productName(selected.productId)}
                </p>
              </div>

              <div className="space-y-2">
                <p className={osUi.sectionLabel}>Answers</p>
                {(selected.answers || []).length === 0 ? (
                  <p className={cn("text-[13px]", osUi.muted)}>
                    Waiting for your reply.
                  </p>
                ) : (
                  (selected.answers || []).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-2 border-b border-black/[0.06] py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{a.userName}</p>
                        <p className="mt-0.5 text-[13px] text-black/60">
                          {a.answer}
                        </p>
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

              <label className="block">
                <span className={osUi.sectionLabel}>Answer as store</span>
                <textarea
                  className={cn(osUi.input, "mt-1 min-h-[90px] resize-y")}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Helpful, specific answer…"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => void postAnswer()}
                  className={osUi.btnPrimary}
                >
                  Post answer
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeQuestion()}
                  className={cn(osUi.btnGhost, osUi.danger)}
                >
                  Delete
                </button>
              </div>
              {status ? (
                <p className="text-[13px] text-black/50">{status}</p>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </ModuleShell>
  );
}
