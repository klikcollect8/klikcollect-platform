'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DeletedItem } from '@/types';
import { 
  X, Trash2, RotateCcw, Calendar, User, Package, MessageSquare, 
  HelpCircle, Tag, ShoppingBag, Search, CheckSquare, Square, 
  AlertCircle, RefreshCw, ArrowUpRight, Clock, Archive
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import Image from 'next/image';

interface BinModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'product' | 'review' | 'question' | 'answer' | 'category' | 'order';
  title?: string;
  filterByReviewId?: boolean;
  filterByQuestionId?: boolean;
  onRestore?: () => void;
}

export default function BinModal({
  isOpen,
  onClose,
  itemType,
  title,
  filterByReviewId,
  filterByQuestionId,
  onRestore,
}: BinModalProps) {
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkAction, setIsBulkAction] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'restore' | 'delete' | 'bulk-restore' | 'bulk-delete';
    itemId: string | null;
    itemName: string;
  }>({
    isOpen: false,
    type: 'restore',
    itemId: null,
    itemName: '',
  });
  
  const { showToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/bin?itemType=${itemType}`);
      if (response.ok) {
        let data = await response.json();
        
        if (!Array.isArray(data)) data = [];
        
        if (itemType === 'answer') {
          if (filterByReviewId) {
            data = data.filter((item: DeletedItem) => item.itemData?.review_id || item.itemData?.reviewId);
          } else if (filterByQuestionId) {
            data = data.filter((item: DeletedItem) => item.itemData?.question_id);
          }
        }
        
        setDeletedItems(data);
        setSelectedIds(new Set()); // Reset selection on refresh
      } else {
        showToast('Failed to load bin items', 'error');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      showToast('Failed to load deleted items', 'error');
    } finally {
      setLoading(false);
    }
  }, [itemType, filterByReviewId, filterByQuestionId, showToast]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !confirmDialog.isOpen) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, confirmDialog.isOpen]);

  // Filtering
  const filteredItems = useMemo(() => {
    return deletedItems.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const displayName = getItemDisplayName(item).toLowerCase();
      return displayName.includes(query);
    });
  }, [deletedItems, searchQuery]);

  // Selection
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  // Actions
  const handleSingleAction = async (action: 'restore' | 'delete') => {
    if (!confirmDialog.itemId) return;
    
    try {
      const endpoint = '/api/admin/bin';
      const options = action === 'restore' 
        ? { method: 'POST', body: JSON.stringify({ deletedItemId: confirmDialog.itemId }) }
        : { method: 'DELETE' };
        
      // For delete, we need to append ID to url
      const url = action === 'delete' 
        ? `${endpoint}?id=${confirmDialog.itemId}` 
        : endpoint;

      // Optimistic update
      setDeletedItems(prev => prev.filter(i => i.id !== confirmDialog.itemId));
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));

      const res = await fetch(url, {
        headers: action === 'restore' ? { 'Content-Type': 'application/json' } : undefined,
        ...options
      });

      if (!res.ok) throw new Error('Action failed');

      showToast(
        action === 'restore' ? 'Item restored successfully' : 'Item permanently deleted', 
        'success'
      );
      
      if (action === 'restore' && onRestore) onRestore();
      await fetchData(); // Refresh to be safe
    } catch (error) {
      showToast('Action failed. Please try again.', 'error');
      fetchData(); // Revert optimistic update
    }
  };

  const handleBulkAction = async (action: 'restore' | 'delete') => {
    if (selectedIds.size === 0) return;
    setIsBulkAction(true);
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));

    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    // Optimistic update
    setDeletedItems(prev => prev.filter(i => !selectedIds.has(i.id)));
    setSelectedIds(new Set());

    try {
      // Process in parallel chunks of 5 to avoid overwhelming server/connection
      const chunkSize = 5;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (id) => {
          try {
            const url = action === 'delete' ? `/api/admin/bin?id=${id}` : '/api/admin/bin';
            const options = action === 'delete' 
              ? { method: 'DELETE' } 
              : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deletedItemId: id }) };
            
            const res = await fetch(url, options);
            if (res.ok) successCount++;
            else failCount++;
          } catch {
            failCount++;
          }
        }));
      }

      if (failCount === 0) {
        showToast(`${successCount} items ${action === 'restore' ? 'restored' : 'deleted'} successfully`, 'success');
      } else {
        showToast(`${successCount} succeeded, ${failCount} failed`, 'info');
        fetchData(); // Sync state if some failed
      }

      if (action === 'restore' && onRestore) onRestore();
    } catch (error) {
      showToast('Batch operation failed', 'error');
      fetchData();
    } finally {
      setIsBulkAction(false);
    }
  };

  // Helpers
  function getItemDisplayName(item: DeletedItem) {
    const data = item.itemData || {};
    switch (item.itemType) {
      case 'product': return data.name || 'Unknown Product';
      case 'review': return data.title || (data.comment ? data.comment.substring(0, 40) + '...' : 'Review');
      case 'question': return data.question ? data.question.substring(0, 40) + '...' : 'Question';
      case 'answer': return data.answer ? data.answer.substring(0, 40) + '...' : 'Answer';
      case 'category': return data.name || 'Category';
      case 'order': return `Order #${data.orderNumber || data.order_number || item.itemId}`;
      default: return 'Unknown Item';
    }
  }

  const Icon = getItemTypeIcon(itemType);
  const displayTitle = title || `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} Recycle Bin`;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div 
          className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
          onClick={onClose} 
        />
        
        <div className="relative w-full max-w-4xl bg-white shadow-2xl shadow-neutral-900/20 rounded-[2rem] flex flex-col max-h-[85vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden ring-1 ring-black/5">
          {/* Header */}
          <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10 shrink-0">
            <div>
              <h2 className="text-2xl font-light text-neutral-900 flex items-center gap-3">
                {displayTitle}
                <span className="flex items-center justify-center h-6 min-w-[1.5rem] px-2 rounded-full bg-neutral-100 text-neutral-600 text-xs font-bold">
                  {deletedItems.length}
                </span>
              </h2>
              <p className="text-neutral-500 text-sm mt-1 font-light">Manage and restore deleted items.</p>
            </div>
            <button 
              onClick={onClose} 
              className="group p-2.5 rounded-full hover:bg-neutral-100 transition-all duration-200 border border-transparent hover:border-neutral-200"
            >
              <X className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="px-8 py-4 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
            <div className="relative w-full sm:w-72 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300 transition-all placeholder:text-neutral-400"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <span className="text-xs font-medium text-neutral-500 hidden sm:inline mr-2">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={() => setConfirmDialog({ isOpen: true, type: 'bulk-restore', itemId: null, itemName: '' })}
                    disabled={isBulkAction}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl text-sm font-medium hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmDialog({ isOpen: true, type: 'bulk-delete', itemId: null, itemName: '' })}
                    disabled={isBulkAction}
                    className="flex items-center gap-2 px-4 py-2 bg-black/[0.04] border border-black/10 text-black/55 rounded-xl text-sm font-medium hover:bg-black/[0.06] transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 bg-neutral-50/30">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-neutral-300" />
                <p className="text-sm font-medium">Loading bin items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Icon className="w-10 h-10 text-neutral-300" />
                </div>
                <h3 className="text-xl font-light text-neutral-900 mb-2">Recycle Bin is Empty</h3>
                <p className="text-neutral-500 text-sm max-w-xs mx-auto">
                  {searchQuery ? 'No items match your search filters.' : 'Deleted items will appear here. They are automatically removed after 30 days.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Select All Header */}
                <div className="flex items-center px-4 mb-2">
                  <button 
                    onClick={toggleSelectAll}
                    className="flex items-center gap-3 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors group"
                  >
                    <div className="p-0.5 rounded transition-colors text-neutral-400 group-hover:text-neutral-900">
                      {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </div>
                    Select All Items
                  </button>
                </div>

                {filteredItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const displayName = getItemDisplayName(item);
                  const itemData = item.itemData || {};

                  return (
                    <div
                      key={item.id}
                      className={`group relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                        isSelected ? 'border-neutral-300 ring-1 ring-neutral-200 shadow-md' : 'border-neutral-100 hover:border-neutral-200'
                      }`}
                    >
                      <div className="p-5 flex items-start gap-5">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className="mt-1 text-neutral-300 hover:text-neutral-900 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-neutral-900" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>

                        {/* Image/Icon */}
                        <div className="shrink-0">
                          {itemType === 'product' && itemData.image ? (
                            <div className="w-16 h-16 rounded-xl bg-neutral-100 overflow-hidden relative border border-neutral-100 shadow-sm">
                              <Image src={itemData.image} alt={displayName} fill className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-neutral-50 flex items-center justify-center border border-neutral-100 shadow-sm">
                              <Icon className="w-7 h-7 text-neutral-400" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 py-0.5">
                          <div className="flex justify-between items-start">
                            <h4 className="text-base font-medium text-neutral-900 truncate pr-4">
                              {displayName}
                            </h4>
                            
                            {/* Action Buttons (Hover) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                              <button
                                onClick={() => setConfirmDialog({ isOpen: true, type: 'restore', itemId: item.id, itemName: displayName })}
                                className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-all"
                                title="Restore"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDialog({ isOpen: true, type: 'delete', itemId: item.id, itemName: displayName })}
                                className="p-2 text-neutral-400 hover:text-black/55 hover:bg-black/[0.04] rounded-full transition-all"
                                title="Delete Forever"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-neutral-500">
                            <div className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
                              <Clock className="w-3.5 h-3.5 text-neutral-400" />
                              <span>Deleted {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}</span>
                            </div>
                            {item.deletedBy && (
                              <div className="flex items-center gap-1.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
                                <User className="w-3.5 h-3.5 text-neutral-400" />
                                <span className="font-mono">
                                  {item.deletedBy.slice(0, 8)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Context Data Tags */}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {itemType === 'product' && itemData.price && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-900 text-white">
                                ${Number(itemData.price).toFixed(2)}
                              </span>
                            )}
                            {itemType === 'product' && itemData.stock !== undefined && (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                itemData.stock === 0 ? 'bg-black/[0.04] text-black/55 border-black/10' : 
                                itemData.stock < 10 ? 'bg-black/[0.04] text-black/60 border-black/10' : 
                                'bg-black/[0.04] text-black border-black/10'
                              }`}>
                                {itemData.stock} in stock
                              </span>
                            )}
                            {itemType === 'review' && itemData.rating && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-black/[0.04] text-yellow-700 border border-yellow-100">
                                {itemData.rating} ★
                              </span>
                            )}
                            {itemType === 'order' && itemData.total && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-900 text-white">
                                Total: ${Number(itemData.total).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="px-8 py-4 bg-neutral-50 border-t border-neutral-100 text-xs text-neutral-400 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Archive className="w-3.5 h-3.5" />
              <span>Items are permanently removed after 30 days</span>
            </div>
            {selectedIds.size > 0 && (
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="hover:text-neutral-900 transition-colors font-medium"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.type.includes('restore') ? 'Restore Items' : 'Permanently Delete'
        }
        message={
          confirmDialog.type === 'bulk-restore' 
            ? `Restore ${selectedIds.size} items? They will return to their original location.`
            : confirmDialog.type === 'bulk-delete'
            ? `Permanently delete ${selectedIds.size} items? This cannot be undone.`
            : confirmDialog.type === 'restore'
            ? `Restore "${confirmDialog.itemName}"?`
            : `Permanently delete "${confirmDialog.itemName}"? This cannot be undone.`
        }
        confirmText={confirmDialog.type.includes('restore') ? 'Restore' : 'Delete Forever'}
        cancelText="Cancel"
        variant={confirmDialog.type.includes('restore') ? 'info' : 'danger'}
        onConfirm={() => {
          if (confirmDialog.type.includes('bulk')) {
            handleBulkAction(confirmDialog.type.includes('restore') ? 'restore' : 'delete');
          } else {
            handleSingleAction(confirmDialog.type === 'restore' ? 'restore' : 'delete');
          }
        }}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}

function getItemTypeIcon(type: string) {
  switch (type) {
    case 'product': return Package;
    case 'review': return MessageSquare;
    case 'question': return HelpCircle;
    case 'answer': return MessageSquare;
    case 'category': return Tag;
    case 'order': return ShoppingBag;
    default: return Trash2;
  }
}
