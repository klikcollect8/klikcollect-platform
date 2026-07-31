'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import BinModal from './BinModal';

interface BinButtonProps {
  itemType: 'product' | 'review' | 'question' | 'answer' | 'category' | 'order';
  title?: string;
  filterByReviewId?: boolean;
  filterByQuestionId?: boolean;
  onRestore?: () => void;
}

export default function BinButton({
  itemType,
  title,
  filterByReviewId,
  filterByQuestionId,
  onRestore,
}: BinButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 text-neutral-600 rounded-full hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300 transition-all text-sm font-medium shadow-sm"
        title="View Deleted Items"
      >
        <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-black/55 transition-colors" />
        <span>{title || 'Recycle Bin'}</span>
      </button>

      <BinModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        itemType={itemType}
        title={title}
        filterByReviewId={filterByReviewId}
        filterByQuestionId={filterByQuestionId}
        onRestore={onRestore}
      />
    </>
  );
}
