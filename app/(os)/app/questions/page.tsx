"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsListRow } from "@/components/os/OsListRow";
import { OsEmptyState } from "@/components/os/OsEmptyState";
import { OsFilterRail } from "@/components/os/OsFilterRail";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type Question = {
  id: string;
  productId: string;
  userName: string;
  question: string;
  answers: unknown[];
  createdAt: string;
};

type ProductRef = { publicId: string; name: string };

export default function OsQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/os/me")
      .then((r) => r.json())
      .then((b) => {
        const id = b?.data?.vendorIds?.[0] || "";
        return fetch(
          id
            ? `/api/os/questions?vendorId=${encodeURIComponent(id)}`
            : "/api/os/questions",
        );
      })
      .then((r) => r?.json())
      .then((j) => {
        if (!j) return;
        if (j.error) setError(j.error.message || "Failed to load");
        else {
          setQuestions(j.data?.questions || []);
          setProducts(j.data?.products || []);
        }
      });
  }, []);

  const productName = (id: string) =>
    products.find((p) => p.publicId === id)?.name || id;

  const unanswered = questions.filter((q) => !(q.answers || []).length).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions.filter((item) => {
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
  }, [questions, products, filterStatus, query]);

  return (
    <ModuleShell
      title="Questions"
      description="Answer shoppers asking about products you sell."
      live
    >
      {error ? (
        <p className={cn("mb-4 text-[13px]", osUi.danger)}>{error}</p>
      ) : null}

      <div className="space-y-5">
        <OsFilterRail
          options={[
            { id: "all", label: "All", count: questions.length },
            { id: "unanswered", label: "Unanswered", count: unanswered },
            { id: "answered", label: "Answered" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
        />

        <input
          className={osUi.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search question, customer, product…"
        />

        {!filtered.length ? (
          <OsEmptyState
            title="No questions match"
            body="Shopper questions on your catalogue will appear here."
          />
        ) : (
          <div className="border-t border-black/10">
            {filtered.map((item) => {
              const answered = (item.answers || []).length > 0;
              return (
                <OsListRow
                  key={item.id}
                  href={`/app/questions/${encodeURIComponent(item.id)}`}
                  title={item.question}
                  meta={`${productName(item.productId)} · ${item.userName} · ${formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}`}
                  status={answered ? "ok" : "pending"}
                  statusLabel={answered ? "Answered" : "Needs answer"}
                />
              );
            })}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
