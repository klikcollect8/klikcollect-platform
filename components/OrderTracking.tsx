'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OrderTracking() {
  const [orderNumber, setOrderNumber] = useState('');
  const router = useRouter();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderNumber.trim()) {
      // In a real app, you'd search for the order and redirect to its page
      router.push(`/order-confirmation/${orderNumber}`);
    }
  };

  return (
    <form onSubmit={handleTrack} className="flex gap-2">
      <input
        type="text"
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
        placeholder="Track your order"
        className="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#6366f1] focus:border-[#6366f1] outline-none"
      />
      <button
        type="submit"
        className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#4f46e5] hover:to-[#7c3aed] text-white px-4 py-2 rounded-md transition-all"
      >
        <Search className="w-5 h-5" />
      </button>
    </form>
  );
}

