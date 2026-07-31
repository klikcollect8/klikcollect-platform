'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, GitCompare } from 'lucide-react';
import ProductComparison from './ProductComparison';

export default function CompareBar() {
  const [comparing, setComparing] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const updateComparing = () => {
      const ids = JSON.parse(localStorage.getItem('comparing') || '[]');
      setComparing(ids);
    };
    
    updateComparing();
    window.addEventListener('storage', updateComparing);
    return () => window.removeEventListener('storage', updateComparing);
  }, []);

  const removeFromCompare = (id: string) => {
    const ids = JSON.parse(localStorage.getItem('comparing') || '[]');
    localStorage.setItem('comparing', JSON.stringify(ids.filter((i: string) => i !== id)));
    window.dispatchEvent(new Event('storage'));
  };

  if (comparing.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 text-white p-4 shadow-2xl z-40 border-t border-neutral-800">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <GitCompare className="w-6 h-6" />
            <div>
              <div className="font-semibold">Comparing {comparing.length} product{comparing.length > 1 ? 's' : ''}</div>
              <div className="text-sm text-neutral-400">
                {comparing.length < 3 ? `Add ${3 - comparing.length} more to compare` : 'Maximum 3 products'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                localStorage.removeItem('comparing');
                window.dispatchEvent(new Event('storage'));
              }}
              className="text-sm hover:underline text-neutral-300 hover:text-white transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={() => setShowComparison(true)}
              disabled={comparing.length < 2}
              className="bg-white text-black px-6 py-2 rounded-full font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Compare Now
            </button>
          </div>
        </div>
      </div>
      
      {showComparison && (
        <ProductComparison
          productIds={comparing}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  );
}

