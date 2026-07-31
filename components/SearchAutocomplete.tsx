"use client";

import { useState, useEffect } from "react";
import { Product, Category } from "@/types";
import Link from "next/link";
import { Grid, ArrowRight } from "lucide-react";
import Image from "next/image";
import { resolveProductImage } from "@/lib/product-image";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { categoryImage } from "@/lib/category-images";

interface CategorySuggestion extends Category {
  type: "category";
}

interface ProductSuggestion extends Product {
  type: "product";
}

type Suggestion = ProductSuggestion | CategorySuggestion;

interface SearchAutocompleteProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSelect?: () => void;
}

export default function SearchAutocomplete({
  query,
  onSelect,
}: SearchAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (query.trim().length === 0) {
      setSuggestions([]);
      return;
    }

    const queryLower = query.toLowerCase().trim();

    fetch("/api/products")
      .then((res) => res.json())
      .then((products: Product[]) => {
        const productSuggestions: ProductSuggestion[] = (products || [])
          .filter((p) => p.name?.toLowerCase().includes(queryLower))
          .sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(queryLower);
            const bStarts = b.name.toLowerCase().startsWith(queryLower);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return 0;
          })
          .slice(0, 5)
          .map((p) => ({ ...p, type: "product" as const }));

        const categorySuggestions: CategorySuggestion[] = V1_CATEGORIES.filter(
          (name) => name.toLowerCase().includes(queryLower),
        )
          .slice(0, 3)
          .map((name, i) => ({
            id: `cat_${i}`,
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            description: "",
            image: categoryImage(name) || "",
            type: "category" as const,
          }));

        setSuggestions([...categorySuggestions, ...productSuggestions]);
      })
      .catch(() => setSuggestions([]));
  }, [query]);

  if (query.trim().length === 0) return null;

  if (suggestions.length === 0) {
    return (
      <div className="absolute left-0 right-0 top-full z-50 mt-2 border border-black/10 bg-[#f7f7f5]/95 px-4 py-6 text-center text-sm text-black/50 backdrop-blur-xl">
        No results for &ldquo;{query}&rdquo;
      </div>
    );
  }

  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden border border-black/10 bg-[#f7f7f5]/95 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl">
      <div className="p-2">
        {suggestions.some((s) => s.type === "category") ? (
          <div className="mb-1">
            <h3 className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">
              Categories
            </h3>
            {suggestions
              .filter((s) => s.type === "category")
              .map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop?category=${encodeURIComponent((cat as CategorySuggestion).name)}`}
                  onClick={onSelect}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-black/[0.03]"
                >
                  <div className="flex h-8 w-8 items-center justify-center bg-black/[0.04] text-black/45">
                    <Grid className="h-4 w-4" />
                  </div>
                  <span className="text-[14px] font-medium text-black">
                    {(cat as CategorySuggestion).name}
                  </span>
                </Link>
              ))}
          </div>
        ) : null}

        {suggestions.some((s) => s.type === "product") ? (
          <div>
            <h3 className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">
              Products
            </h3>
            {suggestions
              .filter((s) => s.type === "product")
              .map((prod) => (
                <Link
                  key={prod.id}
                  href={`/products/${prod.id}`}
                  onClick={onSelect}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-black/[0.03]"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden bg-black/[0.03]">
                    {prod.image ? (
                      <Image
                        src={resolveProductImage(prod.image)}
                        alt={prod.name || "Product"}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[14px] font-medium text-black">
                      {prod.name}
                    </h4>
                    <p className="truncate text-[12px] text-black/40">{prod.category}</p>
                  </div>
                </Link>
              ))}
          </div>
        ) : null}
      </div>

      <Link
        href={`/search?q=${encodeURIComponent(query)}`}
        onClick={onSelect}
        className="flex items-center justify-center gap-2 border-t border-black/[0.06] px-4 py-3.5 text-[13px] font-medium text-black transition-colors hover:bg-black/[0.03]"
      >
        View all results <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
