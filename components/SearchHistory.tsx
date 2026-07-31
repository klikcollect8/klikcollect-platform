'use client';

import { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    setHistory(stored.slice(0, 5)); // Show last 5 searches
  }, []);

  const clearHistory = () => {
    localStorage.removeItem('searchHistory');
    setHistory([]);
  };

  const removeItem = (item: string) => {
    const updated = history.filter(h => h !== item);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
    setHistory(updated);
  };

  const search = (query: string) => {
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  if (history.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-600">Recent Searches</h3>
        <button
          onClick={clearHistory}
          className="text-xs text-[#6366f1] hover:text-[#7c3aed]"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((item, idx) => (
          <button
            key={idx}
            onClick={() => search(item)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-[#0f1111] transition-colors group"
          >
            <Clock className="w-3 h-3 text-gray-500" />
            <span>{item}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-gray-500 hover:text-red-500" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

