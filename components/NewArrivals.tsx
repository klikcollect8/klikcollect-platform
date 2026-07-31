"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types";
import ProductCard from "./ProductCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { formatPrice } from "@/lib/currency";

interface NewArrivalsProps {
  section?: {
    title?: string;
    subtitle?: string;
  };
}

export default function NewArrivals({ section }: NewArrivalsProps) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        const newProducts = arr
          .sort((a: Product, b: Product) => 
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          )
          .slice(0, 5);
        setProducts(newProducts);
      })
      .catch(() => setProducts([]));
  }, []);

  if (products.length === 0) return null;

  const heroProduct = products[0];
  const gridProducts = products.slice(1, 5);

  return (
    <div className="py-16 md:py-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16 gap-6 md:gap-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-black mb-3 md:mb-4 block">
            Latest Collection
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-light text-black tracking-tighter">
            {section?.title || "New Arrivals"}
          </h2>
        </div>
        <Link
          href="/shop?sort=newest"
          className="hidden md:flex group items-center gap-3 text-sm font-bold uppercase tracking-widest text-black border-b border-black pb-1 hover:opacity-60 transition-opacity"
        >
          View Collection
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-0 border border-neutral-200">
        {/* Hero Product */}
        <Link 
          href={`/products/${heroProduct.id}`}
          className="relative group bg-neutral-50 overflow-hidden border-b lg:border-b-0 lg:border-r border-neutral-200 min-h-[400px] md:min-h-[500px] lg:min-h-[600px]"
        >
          <div className="absolute inset-0 p-8 md:p-12 lg:p-16 flex flex-col z-10">
            <div className="flex justify-between items-start">
               <span className="bg-black text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest">
                 Fresh
               </span>
            </div>
            
            <div className="mt-auto">
               <h3 className="text-3xl md:text-4xl md:text-5xl font-light text-black mb-2 md:mb-4 leading-tight group-hover:underline decoration-1 underline-offset-8 transition-all">
                 {heroProduct.name}
               </h3>
               <p className="text-lg md:text-xl font-medium text-neutral-900 mb-6 md:mb-8">
                 {formatPrice(heroProduct.price)}
               </p>
               <span className="inline-flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-widest text-black group-hover:translate-x-2 transition-transform duration-300">
                 Shop Now <ArrowRight className="w-4 h-4" />
               </span>
            </div>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center p-12 md:p-20">
             <div className="relative w-full h-full transform group-hover:scale-105 transition-transform duration-700 ease-out grayscale group-hover:grayscale-0 opacity-50 md:opacity-100 mix-blend-multiply">
                <Image
                  src={heroProduct.image}
                  alt={heroProduct.name}
                  fill
                  className="object-contain mix-blend-multiply"
                />
             </div>
          </div>
        </Link>

        {/* Grid Products - Tight Grid */}
        <div className="grid grid-cols-2">
          {gridProducts.map((product, i) => (
            <div 
              key={product.id} 
              className={`bg-white p-4 md:p-6 hover:bg-neutral-50 transition-colors duration-300 group/card border-b border-neutral-200 ${i % 2 === 0 ? 'border-r' : ''} ${i >= 2 ? 'border-b-0' : ''}`}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
      
      <div className="mt-8 md:hidden">
        <Link
          href="/shop?sort=newest"
          className="flex w-full justify-center items-center gap-2 px-6 py-4 bg-black text-white text-sm font-bold uppercase tracking-widest"
        >
          View Collection
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}