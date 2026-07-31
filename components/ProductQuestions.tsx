"use client";

import { useEffect, useState } from "react";
import { ProductQuestion } from "@/types";
import { format } from "date-fns";

interface ProductQuestionsProps {
  productId: string;
}

export default function ProductQuestions({ productId }: ProductQuestionsProps) {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    userName: "",
    question: "",
  });

  useEffect(() => {
    fetch(`/api/products/${productId}/questions`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setQuestions(list);
        if (list[0]?.id) setOpenId(list[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/products/${productId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        const newQuestion = await response.json();
        setQuestions([newQuestion, ...questions]);
        setOpenId(newQuestion.id);
        setShowForm(false);
        setFormData({ userName: "", question: "" });
      }
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <p className="py-16 text-[11px] uppercase tracking-[0.22em] text-black/35">Loading</p>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-4 border-b border-black/[0.06] pb-8">
        <div>
          <p className="text-[clamp(1.75rem,3vw,2.25rem)] font-medium tracking-tight tabular-nums leading-none">
            {questions.length}
          </p>
          <p className="mt-2 text-[13px] text-black/40">
            {questions.length === 1 ? "question" : "questions"} from shoppers
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-[13px] font-medium underline underline-offset-[5px] decoration-black/20 hover:decoration-black"
        >
          {showForm ? "Cancel" : "Ask a question"}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 border-b border-black/[0.06] pb-12">
          <div>
            <label className="mb-2 block text-[12px] text-black/40">Name</label>
            <input
              type="text"
              required
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              className="w-full border-b border-black/15 bg-transparent py-3 text-[15px] outline-none transition-colors focus:border-black/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-[12px] text-black/40">Question</label>
            <textarea
              required
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              rows={3}
              placeholder="Ask about ingredients, pickup, freshness…"
              className="w-full resize-none border-b border-black/15 bg-transparent py-3 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-black/25 focus:border-black/50"
            />
          </div>
          <button
            type="submit"
            className="bg-black px-6 py-3 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80"
          >
            Submit
          </button>
        </form>
      ) : null}

      {questions.length === 0 ? (
        <div className="py-16">
          <p className="text-[16px] font-medium tracking-tight">No questions yet</p>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-black/45">
            Ask about freshness, pickup windows, or how vendors stock this item.
          </p>
        </div>
      ) : (
        <ul className="mt-2">
          {questions.map((question) => {
            const open = openId === question.id;
            const answerCount = question.answers?.length || 0;
            return (
              <li key={question.id} className="border-b border-black/[0.06]">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : question.id)}
                  className="flex w-full items-start justify-between gap-6 py-8 text-left transition-opacity hover:opacity-70"
                >
                  <span className="min-w-0">
                    <span className="block text-[17px] font-medium leading-snug tracking-tight">
                      {question.question}
                    </span>
                    <span className="mt-2 block text-[12px] text-black/35">
                      {question.userName}
                      {" · "}
                      {format(new Date(question.createdAt), "d MMM yyyy")}
                      {" · "}
                      {answerCount} {answerCount === 1 ? "answer" : "answers"}
                    </span>
                  </span>
                  <span className="mt-1 shrink-0 text-[18px] text-black/25">
                    {open ? "−" : "+"}
                  </span>
                </button>

                {open ? (
                  <div className="pb-8 pl-0 sm:pl-2">
                    {answerCount > 0 ? (
                      <ul className="space-y-6">
                        {question.answers.map((answer) => (
                          <li key={answer.id}>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-black/35">
                              Answer · {answer.userName}
                            </p>
                            <p className="mt-2 max-w-2xl text-[15px] leading-[1.75] text-black/60">
                              {answer.answer}
                            </p>
                            <p className="mt-2 text-[12px] text-black/30">
                              {format(new Date(answer.createdAt), "d MMM yyyy")}
                              {typeof answer.helpfulCount === "number"
                                ? ` · ${answer.helpfulCount} found helpful`
                                : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[14px] text-black/40">
                        No answers yet — a vendor may reply soon.
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
