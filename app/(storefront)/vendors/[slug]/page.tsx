"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, ArrowLeft } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";
import { track } from "@/lib/track";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

type VendorProduct = Product & { offerId?: string; price?: number };

type VendorInfo = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  tagline: string;
  productCount: number;
  categories: string[];
};

export default function VendorStorefrontPage() {
  const params = useParams();
  const slug = String(params.slug || "");
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/vendors/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          setVendor(null);
          setProducts([]);
          return;
        }
        const payload = await r.json();
        const v = payload?.data?.vendor as VendorInfo | undefined;
        const list = Array.isArray(payload?.data?.products)
          ? (payload.data.products as VendorProduct[])
          : [];
        if (!v) {
          setNotFound(true);
          return;
        }
        setVendor(v);
        setProducts(list);
        track("storefront.vendor_viewed", { vendor: v.name, slug }, "customer");
      })
      .catch(() => {
        setNotFound(true);
        setVendor(null);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const categories = useMemo(() => {
    if (vendor?.categories?.length) return vendor.categories;
    return [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  }, [vendor, products]);

  const filtered = useMemo(() => {
    if (category === "all") return products;
    return products.filter((p) => p.category === category);
  }, [products, category]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">Loading</p>
      </div>
    );
  }

  if (notFound || !vendor) {
    return (
      <StorePage narrow>
        <StoreHeading
          eyebrow="Vendors"
          title="Vendor not found"
          description="This shop isn’t approved or doesn’t exist."
        />
        <Link
          href="/brands"
          className="inline-flex border-b border-black pb-0.5 text-[13px] font-medium uppercase tracking-[0.14em]"
        >
          Browse vendors
        </Link>
      </StorePage>
    );
  }

  return (
    <StorePage>
      <Link
        href="/brands"
        className="mb-10 inline-flex items-center gap-1.5 text-[13px] text-black/45 transition-colors hover:text-black"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All vendors
      </Link>

      <StoreHeading
        eyebrow="Store"
        title={vendor.name}
        description={vendor.tagline}
      />

      <div className="mb-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-black/45">
        <p className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {vendor.neighbourhood}
        </p>
        <p>
          {vendor.productCount}{" "}
          {vendor.productCount === 1 ? "product" : "products"}
        </p>
        <p>Click &amp; collect</p>
      </div>

      {categories.length > 1 ? (
        <div className="mb-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-black/[0.06] pt-8">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`text-[13px] transition-colors ${
              category === "all"
                ? "font-medium text-black underline underline-offset-4"
                : "text-black/40 hover:text-black"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`text-[13px] transition-colors ${
                category === cat
                  ? "font-medium text-black underline underline-offset-4"
                  : "text-black/40 hover:text-black"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-12 border-t border-black/[0.06]" />
      )}

      {filtered.length ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <ProductCard
              key={p.offerId || p.id}
              product={p}
              offerPrice={typeof p.price === "number" ? p.price : undefined}
              offerId={p.offerId}
            />
          ))}
        </div>
      ) : (
        <p className="py-16 text-[15px] text-black/45">No products in this store yet.</p>
      )}
    </StorePage>
  );
}
