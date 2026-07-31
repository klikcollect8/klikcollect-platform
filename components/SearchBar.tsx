"use client";

import { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import SearchAutocomplete from "./SearchAutocomplete";

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  defaultValue?: string;
}

export default function SearchBar({
  placeholder = "Search products",
  className = "",
  size = "md",
  defaultValue = "",
}: SearchBarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(defaultValue);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const sizeClasses = {
    sm: "h-10 text-base pl-10",
    md: "h-12 text-base pl-11",
    lg: "h-14 text-base pl-12 sm:text-[17px]",
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-5 h-5",
  };

  return (
    <form onSubmit={handleSearch} className={`relative ${className}`}>
      <div ref={containerRef} className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <Search className={`${iconSizes[size]} text-black/35`} strokeWidth={1.75} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full ${sizeClasses[size]} border border-black/12 bg-transparent pr-4
            text-black placeholder:text-black/35
            transition-colors duration-200
            focus:border-black/40 focus:outline-none
          `}
        />
        <SearchAutocomplete
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSelect={() => setSearchQuery("")}
        />
      </div>
    </form>
  );
}
