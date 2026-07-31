"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Category } from "@/types";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";
import { CATEGORY_CARDS, categoryImage } from "@/lib/category-images";

function fallbackCategories(): Category[] {
  const now = new Date().toISOString();
  return CATEGORY_CARDS.map((cat, i) => ({
    id: String(i + 1),
    name: cat.name,
    slug: cat.name.toLowerCase().replace(/\s+/g, "-"),
    image: cat.image,
    description: "",
    createdAt: now,
    updatedAt: now,
  }));
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length) {
          setCategories(
            data.map((cat: Category) => ({
              ...cat,
              image: categoryImage(cat.name) || cat.image,
            })),
          );
        } else {
          setCategories(fallbackCategories());
        }
      })
      .catch(() => {
        setCategories(fallbackCategories());
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <StorePage>
      <StoreHeading
        eyebrow="Browse"
        title="Categories"
        description="Find products by department"
        action={
          <input
            type="text"
            placeholder="Filter categories"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-black/12 bg-transparent px-4 py-3 text-[14px] placeholder:text-black/35 focus:border-black/40 focus:outline-none sm:w-72"
          />
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse bg-black/[0.04]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="border-t border-black/[0.06] py-16 text-center text-black/50">
          No categories match.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4 xl:gap-x-8">
          {filtered.map((cat) => (
            <Link
              key={cat.id || cat.name}
              href={`/shop?category=${encodeURIComponent(cat.name)}`}
              className="group"
            >
              <div className="relative mb-4 aspect-[4/3] overflow-hidden bg-black/[0.03]">
                {cat.image ? (
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    sizes="320px"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[28px] font-medium text-black/20">
                    {cat.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <h2 className="text-[17px] font-medium tracking-tight">{cat.name}</h2>
              {cat.productCount != null ? (
                <p className="mt-1 text-[13px] text-black/40">{cat.productCount} items</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </StorePage>
  );
}
