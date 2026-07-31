'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { 
  Plus, Edit, Trash2, X, Search, Image as ImageIcon, Folder, 
  Package, Check, ChevronRight, LayoutGrid, Table as TableIcon, 
  CheckSquare, Square, Layers, BarChart3, ArrowUpRight, Calendar,
  MoreHorizontal, ExternalLink, Tag
} from 'lucide-react';
import Image from 'next/image';
import { Category, Product } from '@/types';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import PageContainer from '@/components/admin/PageContainer';
import SectionCard from '@/components/admin/SectionCard';
import AccessControl from '@/components/admin/AccessControl';
import BinButton from '@/components/admin/BinButton';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';

type ViewMode = 'grid' | 'table';

function CategoriesContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modal States
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    icon: '',
  });
  
  // Product Selection for Category Form
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showProductSelector, setShowProductSelector] = useState(false);

  // Confirmation
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'delete' | 'bulk-delete';
    itemId: string | null;
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
      const [catsRes, prodsRes] = await Promise.all([
        fetch('/api/categories').then(r => r.json()).catch(() => []),
        fetch('/api/products').then(r => r.json()).catch(() => [])
      ]);
      
      setCategories(Array.isArray(catsRes) ? catsRes : []);
      setProducts(Array.isArray(prodsRes) ? prodsRes : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Stats ---
  const stats = useMemo(() => {
    return {
      total: categories.length,
      activeProducts: categories.reduce((sum, cat) => sum + (cat.productCount || 0), 0),
      empty: categories.filter(cat => (cat.productCount || 0) === 0).length,
      mostPopulated: [...categories].sort((a, b) => (b.productCount || 0) - (a.productCount || 0))[0]?.name || '-',
    };
  }, [categories]);

  // --- Filtering ---
  const filteredCategories = useMemo(() => {
    let result = categories;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(cat => 
        cat.name.toLowerCase().includes(query) ||
        cat.description?.toLowerCase().includes(query) ||
        cat.slug.toLowerCase().includes(query)
      );
    }
    
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, searchQuery]);

  // --- Actions ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const url = editingCategory ? '/api/categories' : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const body = editingCategory
        ? { id: editingCategory.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (selectedProductIds.length > 0) {
          await updateProductsCategory(formData.name);
        }
        await fetchData();
        resetForm();
        showToast(editingCategory ? 'Category updated' : 'Category created', 'success');
      } else {
        const error = await res.json();
        showToast(error.error || 'Failed to save category', 'error');
      }
    } catch (error) {
      showToast('An error occurred', 'error');
    }
  };

  const updateProductsCategory = async (categoryName: string) => {
    try {
      const updatePromises = selectedProductIds.map(async (productId) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        await fetch(`/api/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: categoryName }),
        });
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to update products:', error);
    }
  };

  const handleDelete = async () => {
    if (confirmDialog.type === 'bulk-delete') {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      
      try {
        setCategories(prev => prev.filter(c => !ids.includes(c.id)));
        setSelectedIds(new Set());
        setConfirmDialog({ isOpen: false, type: 'delete', itemId: null });
        
        await Promise.all(ids.map(id => fetch(`/api/categories?id=${id}`, { method: 'DELETE' })));
        showToast(`${ids.length} categories deleted`, 'success');
      } catch {
        fetchData();
        showToast('Failed to delete categories', 'error');
      }
    } else {
      if (!confirmDialog.itemId) return;
      try {
        setCategories(prev => prev.filter(c => c.id !== confirmDialog.itemId));
        if (viewingCategory?.id === confirmDialog.itemId) setViewingCategory(null);
        setConfirmDialog({ isOpen: false, type: 'delete', itemId: null });
        
        const res = await fetch(`/api/categories?id=${confirmDialog.itemId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Category deleted', 'success');
        } else {
          fetchData();
          showToast('Failed to delete category', 'error');
        }
      } catch {
        fetchData();
        showToast('An error occurred', 'error');
      }
    }
  };

  const openEdit = (category: Category) => {
    setViewingCategory(null); // Close view modal if open
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      icon: category.icon || '',
    });
    
    // Pre-select products
    const categoryProducts = products.filter(p => p.category.toLowerCase() === category.name.toLowerCase());
    setSelectedProductIds(categoryProducts.map(p => p.id));
    setShowForm(true);
  };

  const openView = (category: Category) => {
    setViewingCategory(category);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', image: '', icon: '' });
    setEditingCategory(null);
    setSelectedProductIds([]);
    setProductSearchQuery('');
    setShowProductSelector(false);
    setShowForm(false);
  };

  // --- Selection Helpers ---
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCategories.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCategories.map(c => c.id)));
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // --- Filtered Products ---
  const formFilteredProducts = products.filter(p =>
    productSearchQuery.trim() === '' ||
    p.name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const selectedProductsList = products.filter(p => selectedProductIds.includes(p.id));

  // --- Helper for View Modal ---
  const getCategoryProducts = (categoryName: string) => {
    return products.filter(p => p.category.toLowerCase() === categoryName.toLowerCase());
  };

  if (loading) return null;

  return (
    <PageContainer className="max-w-[1600px] px-6 py-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">Categories</h1>
          <p className="text-neutral-500 font-light mt-2">Organize your products into collections.</p>
        </div>
        <div className="flex items-center gap-3">
          <BinButton itemType="category" onRestore={fetchData} />
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-900/20"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="p-5 rounded-2xl border border-neutral-100 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Total Categories</p>
            <Folder className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-light text-neutral-900">{stats.total}</p>
        </div>
        <div className="p-5 rounded-2xl border border-neutral-100 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Categorized Products</p>
            <Package className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-light text-neutral-900">{stats.activeProducts}</p>
        </div>
        <div className="p-5 rounded-2xl border border-neutral-100 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Empty Categories</p>
            <Layers className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-2xl font-light text-neutral-900">{stats.empty}</p>
        </div>
        <div className="p-5 rounded-2xl border border-neutral-100 bg-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Top Category</p>
            <ArrowUpRight className="w-4 h-4 text-neutral-400" />
          </div>
          <p className="text-lg font-medium text-neutral-900 truncate" title={stats.mostPopulated}>{stats.mostPopulated}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="sticky top-4 z-20 mb-8 space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-neutral-200/60 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent text-sm focus:outline-none placeholder:text-neutral-400"
            />
          </div>
          <div className="w-px h-8 bg-neutral-200 hidden md:block" />
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
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
          {selectedIds.size === filteredCategories.length && filteredCategories.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-neutral-900" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Select All
        </button>
      </div>

      {/* Content */}
      {filteredCategories.length === 0 ? (
        <SectionCard>
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">No Categories Found</h3>
            <p className="text-neutral-500 text-sm mb-4">
              {searchQuery ? 'Try adjusting your search.' : 'Start by creating your first category.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowForm(true)}
                className="text-neutral-900 hover:underline font-medium text-sm"
              >
                Create Category
              </button>
            )}
          </div>
        </SectionCard>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-24">
          {filteredCategories.map(cat => {
            const isSelected = selectedIds.has(cat.id);
            const productCount = cat.productCount || 0;
            
            return (
              <div 
                key={cat.id}
                onClick={() => openView(cat)}
                className={`bg-white rounded-2xl border p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative flex flex-col h-full ${
                  isSelected ? 'border-neutral-300 ring-1 ring-neutral-200' : 'border-neutral-100'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => toggleSelect(cat.id, e)}
                  className="absolute top-5 right-5 p-1 text-neutral-300 hover:text-neutral-900 transition-colors z-10"
                >
                  {isSelected ? <CheckSquare className="w-5 h-5 text-neutral-900" /> : <Square className="w-5 h-5" />}
                </button>

                {/* Icon/Image */}
                <div className="mb-6">
                  {cat.image ? (
                    <div className="w-16 h-16 rounded-2xl bg-neutral-50 relative overflow-hidden border border-neutral-100">
                      <Image src={cat.image} alt={cat.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-neutral-50 flex items-center justify-center border border-neutral-100">
                      <Tag className="w-8 h-8 text-neutral-300" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 mb-4">
                  <h3 className="font-medium text-neutral-900 text-lg mb-1">{cat.name}</h3>
                  <p className="text-sm text-neutral-500 line-clamp-2">{cat.description || 'No description'}</p>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-neutral-50 flex items-center justify-between mt-auto">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-50 text-neutral-600 text-xs font-medium border border-neutral-100">
                    {productCount} products
                  </span>
                  
                  {/* Quick Edit (Hover) */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                      className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
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
                     {selectedIds.size === filteredCategories.length && filteredCategories.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                   </button>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Products</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredCategories.map(cat => {
                const isSelected = selectedIds.has(cat.id);
                return (
                  <tr 
                    key={cat.id}
                    onClick={() => openView(cat)}
                    className={`hover:bg-neutral-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-neutral-50' : ''}`}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => toggleSelect(cat.id, e)} className="text-neutral-300 hover:text-neutral-900">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-neutral-900" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-neutral-100 overflow-hidden relative flex items-center justify-center shrink-0">
                          {cat.image ? (
                            <Image src={cat.image} alt="" fill className="object-cover" />
                          ) : (
                            <span className="text-lg">{cat.icon || '📁'}</span>
                          )}
                        </div>
                        <span className="font-medium text-neutral-900">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-sm text-neutral-500 truncate">{cat.description || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-medium border border-neutral-100">
                        {cat.productCount || 0} items
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-500">
                        {cat.createdAt ? formatDistanceToNow(new Date(cat.createdAt), { addSuffix: true }) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => openEdit(cat)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setConfirmDialog({ isOpen: true, type: 'delete', itemId: cat.id })}
                          className="p-1.5 text-neutral-400 hover:text-black/55 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* View Details Modal */}
      {viewingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setViewingCategory(null)} 
          />
          <div className="relative w-full max-w-4xl bg-white shadow-2xl shadow-neutral-900/20 rounded-[2rem] flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden ring-1 ring-black/5">
            {/* Header */}
            <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center border border-neutral-100 overflow-hidden relative">
                  {viewingCategory.image ? (
                    <Image src={viewingCategory.image} alt={viewingCategory.name} fill className="object-cover" />
                  ) : (
                    <span className="text-2xl">{viewingCategory.icon || '📁'}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-light text-neutral-900">{viewingCategory.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-neutral-500 mt-1">
                    <span>{viewingCategory.productCount || 0} products</span>
                    <span className="text-neutral-300">•</span>
                    <span>Created {viewingCategory.createdAt ? format(new Date(viewingCategory.createdAt), 'MMMM d, yyyy') : 'Recently'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openEdit(viewingCategory)} 
                  className="p-2.5 rounded-full hover:bg-neutral-100 transition-all text-neutral-400 hover:text-neutral-900"
                  title="Edit Category"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <div className="w-px h-8 bg-neutral-100 mx-1" />
                <button 
                  onClick={() => setViewingCategory(null)} 
                  className="p-2.5 rounded-full hover:bg-neutral-100 transition-all text-neutral-400 hover:text-neutral-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-neutral-50/30 p-8 space-y-8">
              {/* Description */}
              {viewingCategory.description && (
                <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
                  <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-neutral-700 leading-relaxed">{viewingCategory.description}</p>
                </div>
              )}

              {/* Products Grid */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-neutral-900">Products in {viewingCategory.name}</h3>
                  <Link 
                    href={`/?category=${encodeURIComponent(viewingCategory.name)}`}
                    target="_blank"
                    className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                  >
                    View on Storefront <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                
                {getCategoryProducts(viewingCategory.name).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getCategoryProducts(viewingCategory.name).map(product => (
                      <div key={product.id} className="bg-white p-3 rounded-xl border border-neutral-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-lg bg-neutral-100 relative overflow-hidden shrink-0">
                          <Image src={product.image} alt={product.name} fill className="object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{product.name}</p>
                          <p className="text-xs text-neutral-500">
                            ${(product.price ?? 0).toFixed(2)}
                          </p>
                        </div>
                        <Link href={`/admin/products?search=${encodeURIComponent(product.name)}`} className="p-1.5 text-neutral-300 hover:text-neutral-900 transition-colors">
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-2xl border border-neutral-100 border-dashed">
                    <Package className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No products assigned to this category.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-neutral-100 bg-white z-10 shrink-0 flex justify-between items-center">
              <span className="text-xs text-neutral-400 font-mono">ID: {viewingCategory.id}</span>
              <button 
                onClick={() => setConfirmDialog({ isOpen: true, type: 'delete', itemId: viewingCategory.id })}
                className="flex items-center gap-2 px-5 py-2.5 bg-black/[0.04] text-black/55 rounded-xl text-sm font-medium hover:bg-black/[0.06] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={resetForm}
          />
          <div className="relative w-full max-w-2xl bg-white shadow-2xl shadow-neutral-900/20 rounded-[2rem] flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden ring-1 ring-black/5">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10 shrink-0">
              <h2 className="text-2xl font-light text-neutral-900">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h2>
              <button 
                onClick={resetForm}
                className="group p-2.5 rounded-full hover:bg-neutral-100 transition-all duration-200"
              >
                <X className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-neutral-50/30 p-8">
              <form id="category-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-neutral-100 space-y-6">
                  {/* Name & Desc */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Category Name</label>
                    <input
                      required
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                      placeholder="e.g. Fresh Produce"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Description</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all resize-none"
                      placeholder="Brief description..."
                    />
                  </div>

                  {/* Visuals */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Image URL</label>
                      <div className="relative">
                        <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          value={formData.image}
                          onChange={e => setFormData(prev => ({ ...prev, image: e.target.value }))}
                          className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Icon (Emoji)</label>
                      <input
                        value={formData.icon}
                        onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 transition-all"
                        placeholder="e.g. 💻"
                      />
                    </div>
                  </div>

                  {/* Image Preview */}
                  {formData.image && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">Preview</label>
                      <div className="relative w-full h-40 rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
                        <Image src={formData.image} alt="Preview" fill className="object-cover" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Product Association */}
                <div className="bg-white p-6 rounded-2xl border border-neutral-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-neutral-900">Assign Products</h3>
                    <button
                      type="button"
                      onClick={() => setShowProductSelector(!showProductSelector)}
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors"
                    >
                      {showProductSelector ? 'Collapse' : 'Expand'}
                      <ChevronRight className={`w-3 h-3 transition-transform ${showProductSelector ? 'rotate-90' : ''}`} />
                    </button>
                  </div>

                  {/* Selected Products Chips */}
                  {selectedProductIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedProductsList.map(product => (
                        <div key={product.id} className="flex items-center gap-2 bg-neutral-50 pl-2 pr-1 py-1 rounded-lg border border-neutral-200 text-xs text-neutral-700 animate-in fade-in zoom-in-95">
                          <span className="truncate max-w-[150px]">{product.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleProductSelection(product.id)}
                            className="p-0.5 hover:bg-neutral-200 rounded text-neutral-400 hover:text-neutral-600 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selector UI */}
                  {showProductSelector && (
                    <div className="space-y-3 animate-in slide-in-from-top-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          value={productSearchQuery}
                          onChange={e => setProductSearchQuery(e.target.value)}
                          placeholder="Filter products..."
                          className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-neutral-300"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {formFilteredProducts.length === 0 ? (
                          <p className="text-center text-xs text-neutral-400 py-4">No products match your search</p>
                        ) : (
                          formFilteredProducts.map(product => {
                            const isSelected = selectedProductIds.includes(product.id);
                            return (
                              <label
                                key={product.id}
                                className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'bg-neutral-900 border-neutral-900 text-white' 
                                    : 'bg-white border-neutral-100 hover:border-neutral-300 text-neutral-600'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleProductSelection(product.id)}
                                  className="hidden"
                                />
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-white bg-white text-neutral-900' : 'border-neutral-300'
                                }`}>
                                  {isSelected && <Check className="w-2.5 h-2.5" />}
                                </div>
                                <span className="text-xs font-medium truncate flex-1">{product.name}</span>
                                <span className={`text-[10px] ${isSelected ? 'text-neutral-400' : 'text-neutral-400'}`}>${product.price}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 border-t border-neutral-100 bg-white z-10 shrink-0 flex gap-3">
              <button 
                type="button" 
                onClick={resetForm}
                className="flex-1 py-3.5 bg-white border border-neutral-200 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                form="category-form"
                className="flex-[2] py-3.5 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-900/20"
              >
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.type === 'bulk-delete' ? `Delete ${selectedIds.size} Categories` : "Delete Category"}
        message="Are you sure? This will remove the category from listings. Associated products will NOT be deleted."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, type: 'delete', itemId: null })}
      />
    </PageContainer>
  );
}

export default function CategoriesPage() {
  return (
    <AccessControl allowedRoles={['head_admin', 'admin', 'editor']}>
      <Suspense fallback={null}>
        <CategoriesContent />
      </Suspense>
    </AccessControl>
  );
}
