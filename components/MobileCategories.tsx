"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ArrowRight } from "lucide-react";
import { V1_CATEGORIES } from "@/lib/curation-policy";
import { categoryImage } from "@/lib/category-images";

interface MobileCategoriesProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileCategories({
  isOpen,
  onClose,
}: MobileCategoriesProps) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] lg:hidden">
      <button
        type="button"
        aria-label="Close categories"
        className="absolute inset-0 bg-black/35 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="absolute inset-x-3 bottom-3 top-[12vh] flex flex-col overflow-hidden border border-white/50 bg-[#f7f7f5]/85 backdrop-blur-2xl sm:inset-x-6">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-5">
          <h2 className="text-xl font-medium tracking-tight">Categories</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-black/40 hover:text-black"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-hide">
          <div className="grid grid-cols-2 gap-4">
            {V1_CATEGORIES.map((name) => {
              const image = categoryImage(name);
              return (
                <Link
                  key={name}
                  href={`/shop?category=${encodeURIComponent(name)}`}
                  onClick={onClose}
                  className="group"
                >
                  <div className="relative aspect-square overflow-hidden bg-black/[0.03]">
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        sizes="160px"
                      />
                    ) : null}
                  </div>
                  <p className="mt-2 text-[13px] font-medium leading-snug text-black/70">
                    {name}
                  </p>
                </Link>
              );
            })}
          </div>
          <Link
            href="/categories"
            onClick={onClose}
            className="mt-8 flex items-center justify-center gap-2 text-[14px] font-medium underline underline-offset-4"
          >
            Browse all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
