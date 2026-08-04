"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types";
import ProductCard from "./ProductCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
interface CuratedPicksProps {
  products?: Product[];
  section?: {
    title?: string;
    subtitle?: string;
    productIds?: string[];
  };
}

export default function CuratedPicks({
  products: initialProducts,
  section,
}: CuratedPicksProps) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      if (section?.productIds && section.productIds.length > 0) {
        setProducts(
          initialProducts.filter((p) => section.productIds!.includes(p.id)),
        );
      } else {
        setProducts(
          [...initialProducts]
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 9),
        );
      }
      return;
    }
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        if (section?.productIds && section.productIds.length > 0) {
          setProducts(
            arr.filter((p: Product) => section.productIds!.includes(p.id)),
          );
        } else {
          setProducts(
            arr
              .sort(
                (a: Product, b: Product) => (b.rating || 0) - (a.rating || 0),
              )
              .slice(0, 9),
          );
        }
      })
      .catch(() => setProducts([]));
  }, [section?.productIds, initialProducts]);

  if (products.length === 0) return null;

  const featuredProduct = products[0];
  const gridProducts = products.slice(1);

  return (
    <div className="py-16 sm:py-24">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-light text-gray-900 mb-3 tracking-tight">
            {section?.title || "Editor's Choice"}
          </h2>
          <p className="text-gray-500 font-medium tracking-wide text-sm uppercase">
            {section?.subtitle ||
              "Handpicked for their exceptional quality and style"}
          </p>
        </div>
        <Link
          href="/shop"
          className="group flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900 hover:text-gray-600 transition-colors"
        >
          Explore Collection
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4">
        {/* Featured Large Item */}
        <div className="relative group rounded-[40px] overflow-hidden bg-gray-100 min-h-[500px] lg:min-h-[600px]">
          <Link
            href={`/products/${featuredProduct.id}`}
            className="block h-full w-full"
          >
            <div className="absolute inset-0 p-12 flex flex-col justify-between z-10">
              <div>
                <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-4">
                  Top Pick
                </span>
                <h3 className="text-3xl sm:text-4xl font-light text-gray-900 mb-2 leading-tight">
                  {featuredProduct.name}
                </h3>
                <p className="text-sm uppercase tracking-widest text-gray-500">
                  {featuredProduct.category}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                Shop Now <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-8 lg:p-16">
              <div className="relative w-full h-full">
                <Image
                  src={featuredProduct.image}
                  alt={featuredProduct.name}
                  fill
                  className="object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>
          </Link>
        </div>

        {/* Grid Items */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {gridProducts.slice(0, 8).map((product) => (
            <div
              key={product.id}
              className="bg-gray-50 rounded-[32px] p-2 group transition-all hover:bg-gray-100"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
