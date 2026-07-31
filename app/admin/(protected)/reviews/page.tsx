'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { ProductReview, Product } from '@/types';
import { 
  Trash2, Star, CheckCircle, MessageSquare, ChevronDown, ChevronRight, 
  Calendar, User, ExternalLink, Send, X, Search, LayoutGrid, 
  Table as TableIcon, CheckSquare, Square, Filter, MoreHorizontal,
  Reply, AlertCircle, ThumbsUp
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import PageContainer from '@/components/admin/PageContainer';
import AccessControl from '@/components/admin/AccessControl';
import BinButton from '@/components/admin/BinButton';
import SectionCard from '@/components/admin/SectionCard';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';

type ViewMode = 'grid' | 'table';

function ReviewsContent() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterRating, setFilterRating] = useState('all'); // 'all', '5', '4', etc.
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Selection & Modal
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  
  // Confirmation
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'delete' | 'bulk-delete' | 'delete-answer';
    itemId: string | null;
    meta?: any;
  }>({
    isOpen: false,
    type: 'delete',
    itemId: null,
  });

  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, reviewsRes] = await Promise.all([
        fetch('/api/products').then(r => r.json()).catch(() => []),
        fetch('/api/reviews').then(r => r.json()).catch(() => [])
      ]);
      
      setProducts(Array.isArray(productsRes) ? productsRes : []);
      setReviews(Array.isArray(reviewsRes) ? reviewsRes : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      showToast('Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getProduct = (productId: string) => products.find(p => p.id === productId);

  // --- Actions ---

  const handleDeleteReview = async () => {
    const id = confirmDialog.itemId;
    if (!id) return;

    // Find product ID from review
    const review = reviews.find(r => r.id === id);
    if (!review) return;

    try {
      // Optimistic update
      setReviews(prev => prev.filter(r => r.id !== id));
      if (selectedReview?.id === id) setSelectedReview(null);
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));

      const response = await fetch(`/api/products/${review.productId}/reviews/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showToast('Review moved to bin', 'success');
      } else {
        fetchData();
        showToast('Failed to delete review', 'error');
      }
    } catch {
      fetchData();
      showToast('An error occurred', 'error');
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      setReviews(prev => prev.filter(r => !ids.includes(r.id)));
      setSelectedIds(new Set());
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      
      // We need product IDs for the delete endpoint
      const reviewsToDelete = reviews.filter(r => ids.includes(r.id));
      
      await Promise.all(reviewsToDelete.map(r => 
        fetch(`/api/products/${r.productId}/reviews/${r.id}`, { method: 'DELETE' })
      ));

      showToast(`${ids.length} reviews moved to bin`, 'success');
    } catch {
      fetchData();
      showToast('Failed to delete reviews', 'error');
    }
  };

  const handleAddReply = async (review: ProductReview) => {
    if (!replyText.trim()) return;

    try {
      setSubmittingReply(true);
      const response = await fetch(`/api/products/${review.productId}/reviews/${review.id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: 'Admin', // Or fetch current user name
          answer: replyText.trim(),
        }),
      });

      if (response.ok) {
        showToast('Reply added successfully', 'success');
        setReplyText('');
        // Refresh data to show new answer
        fetchData().then(() => {
            // Update selected review in modal if open
            if (selectedReview?.id === review.id) {
                // We need to find the updated review from the new data
                // For now, let's just re-fetch or optimistically update if possible
                // Simpler to just re-fetch for now as we don't have the new answer ID easily
            }
        });
        
        // Optimistic update for immediate feedback (partial)
        if (selectedReview?.id === review.id) {
             const newAnswer = {
                 id: 'temp-' + Date.now(),
                 reviewId: review.id,
                 userName: 'Admin',
                 answer: replyText.trim(),
                 helpfulCount: 0,
                 createdAt: new Date().toISOString()
             };
             const updatedReview = { 
                 ...review, 
                 answers: [...(review.answers || []), newAnswer] 
             };
             setSelectedReview(updatedReview);
             setReviews(prev => prev.map(r => r.id === review.id ? updatedReview : r));
        }

      } else {
        showToast('Failed to add reply', 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteAnswer = async () => {
    const { reviewId, answerId, productId } = confirmDialog.meta || {};
    if (!reviewId || !answerId || !productId) return;

    try {
      // Optimistic
      const updateReviews = (currentReviews: ProductReview[]) => {
          return currentReviews.map(r => {
              if (r.id === reviewId) {
                  return { ...r, answers: r.answers?.filter(a => a.id !== answerId) };
              }
              return r;
          });
      };
      
      setReviews(prev => updateReviews(prev));
      if (selectedReview?.id === reviewId) {
          setSelectedReview(prev => prev ? { ...prev, answers: prev.answers?.filter(a => a.id !== answerId) } : null);
      }
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));

      await fetch(`/api/products/${productId}/reviews/${reviewId}/answers/${answerId}`, {
        method: 'DELETE',
      });
      
      showToast('Reply deleted', 'success');
    } catch {
        fetchData();
        showToast('Failed to delete reply', 'error');
    }
  };

  // --- Filtering & Stats ---

  const stats = useMemo(() => {
    return {
      total: reviews.length,
      average: reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0',
      verified: reviews.filter(r => r.verifiedPurchase).length,
      pending: reviews.filter(r => !r.answers || r.answers.length === 0).length, // Reviews without replies
      fiveStar: reviews.filter(r => r.rating === 5).length,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    let result = reviews;

    if (filterProduct !== 'all') {
      result = result.filter(r => r.productId === filterProduct);
    }

    if (filterRating !== 'all') {
      result = result.filter(r => r.rating === parseInt(filterRating));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.userName.toLowerCase().includes(query) ||
        r.title?.toLowerCase().includes(query) ||
        r.comment.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews, filterProduct, filterRating, searchQuery]);

  // --- Selection ---

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredReviews.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredReviews.map(r => r.id)));
  };

  // --- Helpers ---

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-black fill-black';
    if (rating >= 3) return 'text-black/40 fill-black/40';
    return 'text-neutral-300 fill-neutral-300';
  };

  const getRatingBadgeColor = (rating: number) => {
      if (rating >= 5) return 'bg-black/[0.04] text-yellow-700 border-yellow-100';
      if (rating >= 4) return 'bg-black/[0.04] text-black border-black/10';
      if (rating >= 3) return 'bg-neutral-50 text-neutral-700 border-neutral-100';
      return 'bg-black/[0.04] text-black/55 border-black/10';
  };

  if (loading) return null;

  return (
    <PageContainer className="max-w-[1600px] px-6 py-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">Reviews</h1>
          <p className="text-neutral-500 font-light mt-2">Manage customer feedback and ratings.</p>
        </div>
        <div className="flex items-center gap-3">
          <BinButton itemType="answer" title="Answers Bin" filterByReviewId={true} onRestore={fetchData} />
          <BinButton itemType="review" onRestore={fetchData} />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Reviews', value: stats.total, icon: MessageSquare, filter: 'all' },
          { label: 'Average Rating', value: stats.average, icon: Star, filter: 'all' }, // No specific filter for avg
          { label: '5 Star Reviews', value: stats.fiveStar, icon: Star, filter: '5' },
          { label: 'Verified', value: stats.verified, icon: CheckCircle, filter: 'all' }, // Could add verified filter
        ].map((stat, i) => (
          <button 
            key={i}
            onClick={() => stat.filter !== 'all' && setFilterRating(stat.filter)}
            className={`p-5 rounded-2xl border text-left transition-all duration-200 bg-white border-neutral-100 hover:border-neutral-300 hover:shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{stat.label}</p>
              <stat.icon className="w-4 h-4 text-neutral-400" />
            </div>
            <p className="text-2xl font-light text-neutral-900">{stat.value}</p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="sticky top-4 z-20 mb-8 space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-neutral-200/60 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search reviews, authors, products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent text-sm focus:outline-none placeholder:text-neutral-400"
            />
          </div>

          <div className="w-px h-8 bg-neutral-200 hidden md:block" />

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="px-3 py-2 bg-neutral-50 border-none rounded-xl text-sm font-medium text-neutral-700 focus:ring-0 cursor-pointer hover:bg-neutral-100 transition-colors max-w-[150px]"
            >
              <option value="all">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="px-3 py-2 bg-neutral-50 border-none rounded-xl text-sm font-medium text-neutral-700 focus:ring-0 cursor-pointer hover:bg-neutral-100 transition-colors"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            <div className="w-px h-8 bg-neutral-200 hidden md:block mx-1" />

            <div className="flex bg-neutral-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-neutral-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-40 animate-in slide-in-from-bottom-6 fade-in">
          <span className="text-sm font-medium text-neutral-900 border-r border-neutral-200 pr-4">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setConfirmDialog({ isOpen: true, type: 'bulk-delete', itemId: null })}
              className="p-2 text-neutral-400 hover:text-black/55 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-medium">Delete Selected</span>
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="p-2 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Select All */}
      <div className="flex items-center gap-2 mb-4 px-2">
        <button 
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          {selectedIds.size === filteredReviews.length && filteredReviews.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-neutral-900" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Select All
        </button>
      </div>

      {/* Content Grid/Table */}
      {filteredReviews.length === 0 ? (
        <SectionCard>
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">No Reviews Found</h3>
            <p className="text-neutral-500 text-sm">
              Try adjusting your filters or search terms.
            </p>
          </div>
        </SectionCard>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
          {filteredReviews.map(review => {
            const product = getProduct(review.productId);
            const isSelected = selectedIds.has(review.id);
            
            return (
              <div 
                key={review.id}
                onClick={() => setSelectedReview(review)}
                className={`bg-white rounded-2xl border p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative flex flex-col h-full ${
                  isSelected ? 'border-neutral-300 ring-1 ring-neutral-200' : 'border-neutral-100'
                }`}
              >
                 {/* Selection Checkbox */}
                 <button
                  onClick={(e) => toggleSelect(review.id, e)}
                  className="absolute top-6 right-6 p-1 text-neutral-300 hover:text-neutral-900 transition-colors z-10"
                >
                  {isSelected ? <CheckSquare className="w-5 h-5 text-neutral-900" /> : <Square className="w-5 h-5" />}
                </button>

                {/* Header: User & Rating */}
                <div className="flex items-start justify-between mb-4 pr-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                      <span className="text-sm font-medium text-neutral-600">{review.userName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                       <p className="text-sm font-medium text-neutral-900">{review.userName}</p>
                       <p className="text-xs text-neutral-400">{formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}</p>
                    </div>
                  </div>
                </div>

                {/* Star Rating */}
                <div className="flex items-center gap-1 mb-3">
                   {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-neutral-900 fill-neutral-900' : 'text-neutral-200 fill-neutral-200'}`} />
                   ))}
                </div>

                {/* Content */}
                <div className="flex-1 mb-4">
                  {review.title && <h3 className="font-medium text-neutral-900 mb-1 line-clamp-1">{review.title}</h3>}
                  <p className="text-sm text-neutral-500 line-clamp-3 leading-relaxed">{review.comment}</p>
                </div>

                {/* Footer: Product */}
                <div className="pt-4 border-t border-neutral-50 flex items-center gap-3 mt-auto">
                    {product && (
                        <>
                           <div className="w-10 h-10 rounded-lg bg-neutral-100 relative overflow-hidden shrink-0">
                               <Image src={product.image} alt={product.name} fill className="object-cover" />
                           </div>
                           <div className="min-w-0">
                               <p className="text-xs font-medium text-neutral-900 truncate">{product.name}</p>
                               <p className="text-[10px] text-neutral-400">{product.category}</p>
                           </div>
                        </>
                    )}
                </div>

                {/* Quick Actions (Hover) */}
                <div className="absolute top-6 right-14 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                       onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReview(review);
                       }}
                       className="p-1 text-neutral-400 hover:text-neutral-900"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm pb-24">
           <table className="w-full text-left">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-4 w-12">
                   <button onClick={toggleSelectAll} className="text-neutral-400 hover:text-neutral-900">
                     {selectedIds.size === filteredReviews.length && filteredReviews.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                   </button>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Reviewer</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Comment</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
               {filteredReviews.map(review => {
                  const product = getProduct(review.productId);
                  const isSelected = selectedIds.has(review.id);
                  return (
                    <tr 
                      key={review.id} 
                      onClick={() => setSelectedReview(review)}
                      className={`hover:bg-neutral-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-neutral-50' : ''}`}
                    >
                       <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => toggleSelect(review.id, e)} className="text-neutral-300 hover:text-neutral-900">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-neutral-900" /> : <Square className="w-4 h-4" />}
                          </button>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-600 font-medium">
                                {review.userName.charAt(0).toUpperCase()}
                             </div>
                             <span className="text-sm font-medium text-neutral-900">{review.userName}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                             <span className="font-medium text-neutral-900">{review.rating}</span>
                             <Star className="w-3 h-3 text-neutral-400 fill-neutral-400" />
                          </div>
                       </td>
                       <td className="px-6 py-4 max-w-xs">
                          <p className="text-sm text-neutral-600 truncate">{review.title ? `${review.title} - ` : ''}{review.comment}</p>
                       </td>
                       <td className="px-6 py-4">
                          {product ? (
                             <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-neutral-100 relative overflow-hidden shrink-0">
                                   <Image src={product.image} alt="" fill className="object-cover" />
                                </div>
                                <span className="text-sm text-neutral-600 truncate max-w-[150px]">{product.name}</span>
                             </div>
                          ) : (
                             <span className="text-sm text-neutral-400">Unknown Product</span>
                          )}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-neutral-500">{format(new Date(review.createdAt), 'MMM d, yyyy')}</span>
                       </td>
                       <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button 
                             onClick={() => setConfirmDialog({ isOpen: true, type: 'delete', itemId: review.id })}
                             className="p-1.5 text-neutral-400 hover:text-black/55 transition-colors"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       </td>
                    </tr>
                  );
               })}
            </tbody>
           </table>
        </div>
      )}

      {/* Detail Modal (Centered Premium) */}
      {selectedReview && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div 
               className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
               onClick={() => setSelectedReview(null)} 
            />
            
            <div className="relative w-full max-w-4xl bg-white shadow-2xl shadow-neutral-900/20 rounded-[2rem] flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden ring-1 ring-black/5">
               {/* Modal Header */}
               <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10 shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200">
                        <span className="text-xl font-light text-neutral-600">{selectedReview.userName.charAt(0).toUpperCase()}</span>
                     </div>
                     <div>
                        <h2 className="text-xl font-medium text-neutral-900">{selectedReview.userName}</h2>
                        <div className="flex items-center gap-2 text-sm text-neutral-500">
                           <span>{format(new Date(selectedReview.createdAt), 'MMMM d, yyyy')}</span>
                           {selectedReview.verifiedPurchase && (
                              <>
                                 <span className="text-neutral-300">•</span>
                                 <span className="text-black font-medium flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Verified Purchase
                                 </span>
                              </>
                           )}
                        </div>
                     </div>
                  </div>
                  <button 
                     onClick={() => setSelectedReview(null)} 
                     className="group p-2.5 rounded-full hover:bg-neutral-100 transition-all duration-200"
                  >
                     <X className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900" />
                  </button>
               </div>

               {/* Modal Content */}
               <div className="flex-1 overflow-y-auto bg-neutral-50/30">
                  <div className="grid grid-cols-1 lg:grid-cols-3 min-h-full">
                     {/* Left: Product Info */}
                     <div className="lg:col-span-1 p-8 border-r border-neutral-100 bg-white">
                        {(() => {
                           const product = getProduct(selectedReview.productId);
                           if (!product) return null;
                           return (
                              <div className="sticky top-0 space-y-6">
                                 <div className="aspect-square relative rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-100 shadow-sm">
                                    <Image src={product.image} alt={product.name} fill className="object-cover" />
                                 </div>
                                 <div>
                                    <h3 className="font-medium text-neutral-900 text-lg mb-1">{product.name}</h3>
                                    <p className="text-neutral-500 text-sm mb-4">{product.category}</p>
                                    <div className="flex items-center gap-3">
                                       <span className="px-3 py-1 bg-neutral-100 rounded-lg text-sm font-medium text-neutral-900">${product.price.toFixed(2)}</span>
                                       <Link 
                                          href={`/products/${product.id}`} 
                                          target="_blank"
                                          className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5 transition-colors"
                                       >
                                          View on site <ExternalLink className="w-3.5 h-3.5" />
                                       </Link>
                                    </div>
                                 </div>
                              </div>
                           );
                        })()}
                     </div>

                     {/* Right: Review Content & Replies */}
                     <div className="lg:col-span-2 p-8 space-y-8">
                        {/* Rating & Comment */}
                        <div className="space-y-4">
                           <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                 <Star key={i} className={`w-5 h-5 ${i < selectedReview.rating ? 'text-neutral-900 fill-neutral-900' : 'text-neutral-200 fill-neutral-200'}`} />
                              ))}
                              <span className="ml-2 text-sm font-medium text-neutral-900">{selectedReview.rating}.0</span>
                           </div>
                           
                           <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
                              {selectedReview.title && <h3 className="text-lg font-medium text-neutral-900 mb-2">{selectedReview.title}</h3>}
                              <p className="text-neutral-600 leading-relaxed whitespace-pre-wrap">{selectedReview.comment}</p>
                           </div>
                        </div>

                        {/* Replies Section */}
                        <div className="space-y-6 pt-6 border-t border-neutral-200/50">
                           <h4 className="font-medium text-neutral-900 flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" />
                              Replies ({selectedReview.answers?.length || 0})
                           </h4>

                           {/* Existing Replies */}
                           <div className="space-y-4">
                              {selectedReview.answers?.map(answer => (
                                 <div key={answer.id} className="bg-neutral-100/50 rounded-2xl p-5 border border-neutral-100 relative group">
                                    <div className="flex items-center justify-between mb-2">
                                       <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm text-neutral-900">{answer.userName}</span>
                                          <span className="text-xs text-neutral-400">{formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true })}</span>
                                       </div>
                                       <button 
                                          onClick={() => setConfirmDialog({ 
                                             isOpen: true, 
                                             type: 'delete-answer', 
                                             itemId: null, // Unused for delete-answer logic
                                             meta: { reviewId: selectedReview.id, answerId: answer.id, productId: selectedReview.productId }
                                          })}
                                          className="p-1.5 text-neutral-300 hover:text-black/55 transition-colors opacity-0 group-hover:opacity-100"
                                       >
                                          <Trash2 className="w-4 h-4" />
                                       </button>
                                    </div>
                                    <p className="text-sm text-neutral-600">{answer.answer}</p>
                                 </div>
                              ))}
                           </div>

                           {/* Add Reply */}
                           <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center shrink-0 mt-1">
                                 <Reply className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 space-y-3">
                                 <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="w-full p-4 bg-white border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300 resize-none transition-all placeholder:text-neutral-400 min-h-[100px]"
                                 />
                                 <div className="flex justify-end">
                                    <button
                                       onClick={() => handleAddReply(selectedReview)}
                                       disabled={!replyText.trim() || submittingReply}
                                       className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-neutral-900/10 flex items-center gap-2"
                                    >
                                       {submittingReply ? (
                                          <span className="animate-pulse">Sending...</span>
                                       ) : (
                                          <>
                                             <Send className="w-4 h-4" /> Post Reply
                                          </>
                                       )}
                                    </button>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Modal Footer */}
               <div className="px-8 py-5 border-t border-neutral-100 bg-white flex justify-between items-center z-10 shrink-0">
                  <span className="text-xs text-neutral-400 font-mono">ID: {selectedReview.id}</span>
                  <button 
                     onClick={() => setConfirmDialog({ isOpen: true, type: 'delete', itemId: selectedReview.id })}
                     className="flex items-center gap-2 px-5 py-2.5 bg-black/[0.04] text-black/55 rounded-xl text-sm font-medium hover:bg-black/[0.06] transition-colors"
                  >
                     <Trash2 className="w-4 h-4" />
                     Delete Review
                  </button>
               </div>
            </div>
         </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.type === 'delete-answer' ? "Delete Reply" : "Delete Review"}
        message="Are you sure? This will move the item to the bin."
        confirmText="Delete"
        variant="danger"
        onConfirm={() => {
           if (confirmDialog.type === 'delete-answer') handleDeleteAnswer();
           else if (confirmDialog.type === 'bulk-delete') handleBulkDelete();
           else handleDeleteReview();
        }}
        onCancel={() => setConfirmDialog({ isOpen: false, type: 'delete', itemId: null })}
      />
    </PageContainer>
  );
}

export default function ReviewsPage() {
  return (
    <AccessControl allowedRoles={['head_admin', 'admin', 'moderator']}>
      <Suspense fallback={null}>
        <ReviewsContent />
      </Suspense>
    </AccessControl>
  );
}
