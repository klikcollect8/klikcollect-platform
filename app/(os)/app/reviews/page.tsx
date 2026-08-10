"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ModuleShell } from "@/components/os/ModuleShell";
import { OsListRow } from "@/components/os/OsListRow";
import { OsEmptyState } from "@/components/os/OsEmptyState";
import { OsFilterRail } from "@/components/os/OsFilterRail";
import { osUi } from "@/components/os/os-ui";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  productId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  status?: string;
};

type ProductRef = { publicId: string; name: string };

export default function OsReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
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
            ? `/api/os/reviews?vendorId=${encodeURIComponent(id)}`
            : "/api/os/reviews",
        );
      })
      .then((r) => r?.json())
      .then((j) => {
        if (!j) return;
        if (j.error) setError(j.error.message || "Failed to load");
        else {
          setReviews(j.data?.reviews || []);
          setProducts(j.data?.products || []);
        }
      });
  }, []);

  const productName = (id: string) =>
    products.find((p) => p.publicId === id)?.name || id;

  const hidden = reviews.filter((r) => r.status === "hidden").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      if (filterStatus === "approved" && (r.status || "approved") !== "approved")
        return false;
      if (filterStatus === "hidden" && r.status !== "hidden") return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q) ||
        productName(r.productId).toLowerCase().includes(q)
      );
    });
  }, [reviews, products, filterStatus, query]);

  return (
    <ModuleShell
      title="Reviews"
      description="Moderate ratings and replies on products you sell."
      live
    >
      {error ? (
        <p className={cn("mb-4 text-[13px]", osUi.danger)}>{error}</p>
      ) : null}

      <div className="space-y-5">
        <OsFilterRail
          options={[
            { id: "all", label: "All", count: reviews.length },
            { id: "approved", label: "Visible" },
            { id: "hidden", label: "Hidden", count: hidden },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
        />

        <input
          className={osUi.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, title, product…"
        />

        {!filtered.length ? (
          <OsEmptyState
            title="No reviews match"
            body="Customer ratings on your catalogue will appear here."
          />
        ) : (
          <div className="border-t border-black/10">
            {filtered.map((r) => (
              <OsListRow
                key={r.id}
                href={`/app/reviews/${encodeURIComponent(r.id)}`}
                title={r.title || `${r.rating}★ review`}
                meta={`${r.rating}★ · ${productName(r.productId)} · ${r.userName} · ${formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}`}
                status={r.status === "hidden" ? "rejected" : "ok"}
                statusLabel={r.status === "hidden" ? "Hidden" : "Visible"}
              />
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
