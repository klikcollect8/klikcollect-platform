"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ModuleShell } from "@/components/os/ModuleShell";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type ReviewAnswer = {
  id: string;
  userName: string;
  answer: string;
  createdAt: string;
};

type Review = {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: string;
  status?: string;
  answers?: ReviewAnswer[];
};

type ProductRef = { publicId: string; name: string; imageUrl: string | null };

export default function OsReviewsPage() {
  const [vendorId, setVendorId] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterRating, setFilterRating] = useState("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "approved" | "hidden"
  >("all");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = (vid?: string) =>
    void fetch(
      vid
        ? `/api/os/reviews?vendorId=${encodeURIComponent(vid)}`
        : "/api/os/reviews",
    )
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message || "Failed to load");
        else {
          setError(null);
          setReviews(j.data?.reviews || []);
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
    return reviews.filter((r) => {
      if (filterProduct !== "all" && r.productId !== filterProduct)
        return false;
      if (filterRating !== "all" && String(r.rating) !== filterRating)
        return false;
      if (filterStatus !== "all" && (r.status || "approved") !== filterStatus)
        return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q) ||
        productName(r.productId).toLowerCase().includes(q)
      );
    });
  }, [reviews, products, filterProduct, filterRating, filterStatus, query]);

  const selected = reviews.find((r) => r.id === selectedId) || null;

  async function postReply() {
    if (!selected || !reply.trim() || !vendorId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/os/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          vendorId,
          reviewId: selected.id,
          answer: reply.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.error?.message || "Reply failed");
        return;
      }
      setReply("");
      setStatus("Reply posted");
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  async function setReviewStatus(next: "approved" | "hidden") {
    if (!selected || !vendorId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/os/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          vendorId,
          reviewId: selected.id,
          status: next,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.error?.message || "Update failed");
        return;
      }
      setStatus(next === "hidden" ? "Hidden from storefront" : "Visible again");
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  async function removeReview() {
    if (!selected || !vendorId) return;
    if (!window.confirm("Remove this review from your storefront?")) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/os/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, reviewId: selected.id }),
      });
      const j = await res.json();
      if (!res.ok) {
        setStatus(j.error?.message || "Delete failed");
        return;
      }
      setSelectedId(null);
      setStatus("Review removed");
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  async function removeAnswer(answerId: string) {
    if (!selected || !vendorId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/os/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          reviewId: selected.id,
          answerId,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setStatus(j.error?.message || "Failed to remove reply");
        return;
      }
      await load(vendorId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModuleShell
      title="Reviews"
      description="Moderate ratings and replies on products you sell. Tenant-scoped - not platform-wide."
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
            placeholder="Customer, title, product…"
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
        <label className="min-w-[100px]">
          <span className={osUi.sectionLabel}>Stars</span>
          <select
            className={osUi.input}
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
          >
            <option value="all">All</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[120px]">
          <span className={osUi.sectionLabel}>Visibility</span>
          <select
            className={osUi.input}
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as "all" | "approved" | "hidden")
            }
          >
            <option value="all">All</option>
            <option value="approved">Visible</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="divide-y divide-black/[0.06] border-b border-black/10">
          <div className="flex items-baseline justify-between pb-3">
            <p className={osUi.sectionLabel}>{filtered.length} reviews</p>
          </div>
          {!filtered.length ? (
            <p className={cn("py-10 text-[14px]", osUi.muted)}>
              No reviews on your catalogue yet.
            </p>
          ) : null}
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSelectedId(r.id);
                setReply("");
                setStatus(null);
              }}
              className={cn(
                "flex w-full items-start justify-between gap-3 py-3.5 text-left transition-colors",
                selectedId === r.id
                  ? "text-black"
                  : "text-black/55 hover:text-black",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium">
                  {r.title || "Review"}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-black/40">
                  {productName(r.productId)} · {r.userName}
                  {r.status === "hidden" ? " · Hidden" : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] tabular-nums">{r.rating}★</p>
                <p className="mt-0.5 text-[11px] text-black/35">
                  {formatDistanceToNow(new Date(r.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </button>
          ))}
        </div>

        <aside className="space-y-5 border-t border-black/10 pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          {!selected ? (
            <p className={cn("text-[14px]", osUi.muted)}>
              Select a review to reply, hide, or remove.
            </p>
          ) : (
            <>
              <div>
                <p className={osUi.sectionLabel}>Review</p>
                <p className="mt-2 text-[18px] font-medium tracking-tight">
                  {selected.title || "Untitled"}
                </p>
                <p className="mt-1 text-[13px] text-black/40">
                  {selected.rating}★ · {selected.userName}
                  {selected.verifiedPurchase ? " · Verified" : ""}
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-black/70">
                  {selected.comment}
                </p>
                <p className="mt-2 text-[12px] text-black/35">
                  {productName(selected.productId)}
                </p>
              </div>

              <div className="space-y-2">
                <p className={osUi.sectionLabel}>Store replies</p>
                {(selected.answers || []).length === 0 ? (
                  <p className={cn("text-[13px]", osUi.muted)}>
                    No replies yet.
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
                <span className={osUi.sectionLabel}>Reply as store</span>
                <textarea
                  className={cn(osUi.input, "mt-1 min-h-[90px] resize-y")}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Thank the customer or address the issue…"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => void postReply()}
                  className={osUi.btnPrimary}
                >
                  Post reply
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void setReviewStatus(
                      selected.status === "hidden" ? "approved" : "hidden",
                    )
                  }
                  className={osUi.btnSecondary}
                >
                  {selected.status === "hidden" ? "Show" : "Hide"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeReview()}
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
