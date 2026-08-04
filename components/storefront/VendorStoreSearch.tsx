"use client";

import { Search } from "lucide-react";

export default function VendorStoreSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search this store"}
        className="w-full border border-black/12 bg-transparent py-3 pl-11 pr-4 text-[14px] focus:border-black/40 focus:outline-none"
      />
    </div>
  );
}
