"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight } from "lucide-react";
import { V1_CATEGORIES } from "@/lib/curation-policy";

export default function CategoriesMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[14px] font-medium text-black/75 transition-opacity hover:opacity-45"
      >
        Categories
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-50 mt-3 w-[320px] border border-black/10 bg-[#f7f7f5]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.12)] backdrop-blur-xl sm:w-[420px]">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {V1_CATEGORIES.map((name) => (
              <Link
                key={name}
                href={`/shop?category=${encodeURIComponent(name)}`}
                onClick={() => setIsOpen(false)}
                className="px-3 py-2.5 text-[13px] font-medium text-black/75 transition-colors hover:bg-black/[0.03] hover:text-black"
              >
                {name}
              </Link>
            ))}
          </div>
          <Link
            href="/categories"
            onClick={() => setIsOpen(false)}
            className="mt-3 flex items-center justify-center gap-2 border-t border-black/[0.06] pt-3 text-[13px] font-medium text-black"
          >
            All categories <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
