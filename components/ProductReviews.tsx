"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductReview } from "@/types";
import { Star } from "lucide-react";
import { format } from "date-fns";

interface ProductReviewsProps {
  productId: string;
  vendorName?: string;
}

export default function ProductReviews({
  productId,
  vendorName,
}: ProductReviewsProps) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    userName: "",
    rating: 5,
    title: "",
    comment: "",
  });

  useEffect(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productId]);

  const summary = useMemo(() => {
    if (!reviews.length) {
      return { avg: 0, counts: [0, 0, 0, 0, 0] as number[] };
    }
    const counts = [0, 0, 0, 0, 0];
    let sum = 0;
    for (const r of reviews) {
      sum += r.rating;
      const idx = Math.min(5, Math.max(1, r.rating)) - 1;
      counts[idx] += 1;
    }
    return { avg: sum / reviews.length, counts };
  }, [reviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, verifiedPurchase: true }),
      });
      if (response.ok) {
        const newReview = await response.json();
        setReviews([newReview, ...reviews]);
        setShowForm(false);
        setFormData({ userName: "", rating: 5, title: "", comment: "" });
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
      {vendorName ? (
        <p className="mb-8 text-[13px] text-black/45">
          Reviews for pickups from{" "}
          <span className="font-medium text-black/80">{vendorName}</span>
        </p>
      ) : null}

      {/* Summary */}
      <div className="grid gap-10 border-b border-black/[0.06] pb-12 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-16">
        <div>
          <p className="text-[clamp(2.75rem,5vw,3.75rem)] font-medium tracking-tight tabular-nums leading-none">
            {reviews.length ? summary.avg.toFixed(1) : "—"}
          </p>
          <div className="mt-3 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-3.5 w-3.5 ${
                  n <= Math.round(summary.avg)
                    ? "fill-black text-black"
                    : "text-black/15"
                }`}
                strokeWidth={1.5}
              />
            ))}
          </div>
          <p className="mt-3 text-[13px] text-black/40">
            {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
          </p>
        </div>

        <div className="space-y-2.5">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = summary.counts[stars - 1];
            const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
            return (
              <div key={stars} className="flex items-center gap-3">
                <span className="w-3 text-[12px] tabular-nums text-black/40">{stars}</span>
                <div className="h-px flex-1 overflow-hidden bg-black/[0.06]">
                  <div
                    className="h-full bg-black/70 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[12px] tabular-nums text-black/35">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
          All reviews
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-[13px] font-medium underline underline-offset-[5px] decoration-black/20 hover:decoration-black"
        >
          {showForm ? "Cancel" : "Write a review"}
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
            <label className="mb-2 block text-[12px] text-black/40">Rating</label>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating })}
                  aria-label={`${rating} stars`}
                  className="inline-flex h-11 w-11 items-center justify-center"
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${
                      formData.rating >= rating
                        ? "fill-black text-black"
                        : "text-black/15 hover:text-black/40"
                    }`}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-[12px] text-black/40">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border-b border-black/15 bg-transparent py-3 text-[15px] outline-none transition-colors focus:border-black/50"
            />
          </div>
          <div>
            <label className="mb-2 block text-[12px] text-black/40">Review</label>
            <textarea
              required
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={4}
              className="w-full resize-none border-b border-black/15 bg-transparent py-3 text-[15px] leading-relaxed outline-none transition-colors focus:border-black/50"
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

      {reviews.length === 0 ? (
        <div className="py-16">
          <p className="text-[16px] font-medium tracking-tight">No reviews yet</p>
          <p className="mt-2 text-[14px] text-black/45">
            Be the first to share how this product worked for you.
          </p>
        </div>
      ) : (
        <ul className="mt-2">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="border-b border-black/[0.06] py-10 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-[15px] font-medium tracking-tight">{review.userName}</p>
                <p className="text-[12px] text-black/35">
                  {format(new Date(review.createdAt), "d MMM yyyy")}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < review.rating ? "fill-black text-black" : "text-black/15"
                      }`}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                {review.verifiedPurchase ? (
                  <span className="text-[11px] uppercase tracking-[0.14em] text-black/35">
                    Verified
                  </span>
                ) : null}
              </div>
              <h4 className="mt-4 text-[17px] font-medium tracking-tight">{review.title}</h4>
              <p className="mt-3 max-w-2xl text-[15px] leading-[1.75] text-black/55">
                {review.comment}
              </p>
              <button
                type="button"
                className="mt-5 text-[12px] text-black/35 transition-colors hover:text-black"
              >
                Helpful · {review.helpfulCount || 0}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
