'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Order } from '@/types';
import { format } from 'date-fns';
import { 
  CheckCircle, Clock, Package, ShoppingBag, Search, X, LayoutGrid, 
  Table as TableIcon, Calendar, User, Phone, Mail, Trash2, Printer, 
  Copy, MoreHorizontal, CheckSquare, Square, ChevronRight, Truck, CreditCard
} from 'lucide-react';
import PageContainer from '@/components/admin/PageContainer';
import AccessControl from '@/components/admin/AccessControl';
import BinButton from '@/components/admin/BinButton';
import SectionCard from '@/components/admin/SectionCard';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import Image from 'next/image';

type ViewMode = 'grid' | 'table';
type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'collected' | 'cancelled';

function OrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(searchParams?.get('filter') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; orderId: string | null; isBulk?: boolean }>({
    isOpen: false,
    orderId: null,
    isBulk: false,
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  const { showToast } = useToast();

  useEffect(() => {
    fetchOrders();
    const urlFilter = searchParams?.get('filter');
    if (urlFilter) setFilter(urlFilter);
  }, [searchParams]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      showToast('Failed to load orders', 'error');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Actions ---

  const updateOrderStatus = async (id: string, status: Order['status']) => {
    try {
      setUpdatingId(id);
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      if (selectedOrder?.id === id) setSelectedOrder(prev => prev ? { ...prev, status } : null);

      const response = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        showToast(`Order marked as ${status}`, 'success');
      } else {
        // Revert on failure
        fetchOrders();
        showToast('Failed to update status', 'error');
      }
    } catch {
      fetchOrders();
      showToast('An error occurred', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkStatusUpdate = async (status: Order['status']) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      // Optimistic
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o));
      setSelectedIds(new Set());
      showToast(`Updating ${ids.length} orders...`, 'info');

      await Promise.all(ids.map(id => 
        fetch(`/api/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      ));

      showToast('Bulk update completed', 'success');
    } catch {
      fetchOrders();
      showToast('Some updates failed', 'error');
    }
  };

  const deleteOrder = async () => {
    if (deleteConfirm.isBulk) {
      const ids = Array.from(selectedIds);
      try {
        setOrders(prev => prev.filter(o => !ids.includes(o.id)));
        setSelectedIds(new Set());
        setDeleteConfirm({ isOpen: false, orderId: null });
        
        await Promise.all(ids.map(id => fetch(`/api/orders/${id}`, { method: 'DELETE' })));
        showToast(`${ids.length} orders moved to bin`, 'success');
      } catch {
        fetchOrders();
        showToast('Failed to delete orders', 'error');
      }
    } else {
      if (!deleteConfirm.orderId) return;
      try {
        setOrders(prev => prev.filter(o => o.id !== deleteConfirm.orderId));
        if (selectedOrder?.id === deleteConfirm.orderId) setSelectedOrder(null);
        setDeleteConfirm({ isOpen: false, orderId: null });

        const res = await fetch(`/api/orders/${deleteConfirm.orderId}`, { method: 'DELETE' });
        if (res.ok) showToast('Order moved to bin', 'success');
        else throw new Error();
      } catch {
        fetchOrders();
        showToast('Failed to delete order', 'error');
      }
    }
  };

  // --- Filtering & Stats ---

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      ready: orders.filter(o => o.status === 'ready').length,
      collected: orders.filter(o => o.status === 'collected').length,
      revenue: orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.total : 0), 0),
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    
    if (filter !== 'all') {
      result = result.filter(order => order.status === filter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerEmail.toLowerCase().includes(query)
      );
    }
    
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, filter, searchQuery]);

  // --- Selection Helpers ---

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredOrders.map(o => o.id)));
  };

  // --- Render Helpers ---

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-black/[0.04] text-black/60 border-black/10';
      case 'confirmed': return 'bg-black/[0.04] text-black border-black/10';
      case 'ready': return 'bg-black/[0.04] text-black border-black/10';
      case 'collected': return 'bg-black/[0.04] text-black border-black/10';
      case 'cancelled': return 'bg-black/[0.04] text-black/55 border-black/10';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  };

  if (loading) return null; // Or a sleek loading skeleton

  return (
    <PageContainer className="max-w-[1600px] px-6 py-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">Orders</h1>
          <p className="text-neutral-500 font-light mt-2">Track and manage customer orders.</p>
        </div>
        <div className="flex items-center gap-3">
          <BinButton itemType="order" onRestore={fetchOrders} />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Total Orders', value: stats.total, filter: 'all' },
          { label: 'Pending', value: stats.pending, filter: 'pending', alert: stats.pending > 0 },
          { label: 'Confirmed', value: stats.confirmed, filter: 'confirmed' },
          { label: 'Ready', value: stats.ready, filter: 'ready' },
          { label: 'Collected', value: stats.collected, filter: 'collected' },
        ].map((stat, i) => {
          const isActive = filter === stat.filter;
          return (
            <button 
              key={i} 
              onClick={() => setFilter(stat.filter)}
              className={`p-5 rounded-2xl border text-left transition-all duration-200 ${
                isActive 
                  ? 'ring-1 ring-neutral-300 border-neutral-300 bg-neutral-50' 
                  : `bg-white hover:border-neutral-300 hover:shadow-sm ${stat.alert ? 'border-black/10 bg-black/[0.04]/30' : 'border-neutral-100'}`
              }`}
            >
              <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${
                stat.alert ? 'text-black/60' : 'text-neutral-500'
              }`}>
                {stat.label}
              </p>
              <p className={`text-2xl font-light ${
                stat.alert ? 'text-black' : 'text-neutral-900'
              }`}>
                {stat.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="sticky top-4 z-20 mb-8 space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-neutral-200/60 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by order #, name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent text-sm focus:outline-none placeholder:text-neutral-400"
            />
          </div>

          <div className="w-px h-8 bg-neutral-200 hidden md:block" />

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 bg-neutral-50 border-none rounded-xl text-sm font-medium text-neutral-700 focus:ring-0 cursor-pointer hover:bg-neutral-100 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="ready">Ready to Pickup</option>
              <option value="collected">Collected</option>
              <option value="cancelled">Cancelled</option>
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

      {/* Select All Checkbox (Floating if needed or inline) */}
      <div className="flex items-center gap-2 mb-4 px-2">
        <button 
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          {selectedIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-neutral-900" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Select All
        </button>
        {selectedIds.size > 0 && (
          <span className="text-xs text-neutral-400">• {selectedIds.size} selected</span>
        )}
      </div>

      {/* Content */}
      {filteredOrders.length === 0 ? (
        <SectionCard>
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">No Orders Found</h3>
            <p className="text-neutral-500 text-sm">
              {searchQuery || filter !== 'all' ? 'Try adjusting your filters.' : 'Waiting for the first order.'}
            </p>
          </div>
        </SectionCard>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
          {filteredOrders.map(order => {
            const isSelected = selectedIds.has(order.id);
            return (
              <div 
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`bg-white rounded-2xl border p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative ${
                  isSelected ? 'border-neutral-300 ring-1 ring-neutral-200' : 'border-neutral-100'
                }`}
              >
                {/* Selection Checkbox */}
                <button
                  onClick={(e) => toggleSelect(order.id, e)}
                  className="absolute top-6 right-6 p-1 text-neutral-300 hover:text-neutral-900 transition-colors z-10"
                >
                  {isSelected ? <CheckSquare className="w-5 h-5 text-neutral-900" /> : <Square className="w-5 h-5" />}
                </button>

                <div className="flex justify-between items-start mb-6 pr-8">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-neutral-900">#{order.orderNumber}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-neutral-600">
                    <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-neutral-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 truncate">{order.customerName}</p>
                      <p className="text-xs text-neutral-400 truncate">{order.customerEmail}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-50 rounded-xl p-3 mb-6 space-y-2">
                  {order.items.slice(0, 2).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="text-neutral-600 truncate flex-1 pr-4">
                        <span className="font-medium text-neutral-900">{item.quantity}x</span> {item.product.name}
                      </span>
                      <span className="text-neutral-900 font-medium">
                        ${(item.quantity * (item.offerPrice ?? item.product.price ?? 0)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <p className="text-xs text-neutral-400 text-center pt-1 border-t border-neutral-200/50">
                      + {order.items.length - 2} more items
                    </p>
                  )}
                  <div className="flex justify-between items-center text-xs font-semibold text-neutral-900 pt-2 border-t border-neutral-200/50">
                    <span>Total</span>
                    <span>${order.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Quick Actions (Hover only) */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button className="flex-1 py-2 bg-neutral-900 text-white rounded-lg text-xs font-medium">
                    View Details
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
                    {selectedIds.size === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">Total</th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredOrders.map(order => {
                const isSelected = selectedIds.has(order.id);
                return (
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className={`hover:bg-neutral-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-neutral-50' : ''}`}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => toggleSelect(order.id, e)} className="text-neutral-300 hover:text-neutral-900">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-neutral-900" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-neutral-900">#{order.orderNumber}</span>
                      <p className="text-xs text-neutral-500">{order.items.length} items</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-900">{order.customerName}</span>
                        <span className="text-xs text-neutral-500">{order.customerEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-neutral-600">{format(new Date(order.createdAt), 'MMM d, h:mm a')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-neutral-900">
                      ${order.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Actions Floating Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-neutral-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-40 animate-in slide-in-from-bottom-6 fade-in">
          <span className="text-sm font-medium text-neutral-900 border-r border-neutral-200 pr-4">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBulkStatusUpdate('confirmed')} className="px-3 py-1.5 bg-black/[0.04] text-black hover:bg-black/[0.06] rounded-lg text-xs font-medium transition-colors">
              Mark Confirmed
            </button>
            <button onClick={() => handleBulkStatusUpdate('ready')} className="px-3 py-1.5 bg-black/[0.04] text-black hover:bg-black/[0.06] rounded-lg text-xs font-medium transition-colors">
              Mark Ready
            </button>
            <button onClick={() => handleBulkStatusUpdate('collected')} className="px-3 py-1.5 bg-black/[0.04] text-black hover:bg-black/[0.06] rounded-lg text-xs font-medium transition-colors">
              Mark Collected
            </button>
            <div className="w-px h-6 bg-neutral-200 mx-1" />
            <button onClick={() => setDeleteConfirm({ isOpen: true, orderId: null, isBulk: true })} className="p-2 text-neutral-400 hover:text-black/55 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="p-2 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Order Details Modal (Pop-up) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div 
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300" 
            onClick={() => setSelectedOrder(null)} 
          />
          <div className="relative w-full max-w-4xl bg-white shadow-2xl shadow-neutral-900/20 rounded-[2rem] flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden ring-1 ring-black/5">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-neutral-100 flex items-start justify-between bg-white/80 backdrop-blur-xl z-10 shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-light tracking-tight text-neutral-900">
                    #{selectedOrder.orderNumber}
                  </h2>
                  <div className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500 font-light">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  <span>Placed on <span className="font-medium text-neutral-700">{format(new Date(selectedOrder.createdAt), 'MMMM d, yyyy')}</span></span>
                  <span className="text-neutral-300">•</span>
                  <span>{format(new Date(selectedOrder.createdAt), 'h:mm a')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="group p-2.5 rounded-full hover:bg-neutral-100 transition-all duration-200 border border-transparent hover:border-neutral-200"
                  title="Print Invoice"
                >
                  <Printer className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900" />
                </button>
                <div className="w-px h-8 bg-neutral-100 mx-1" />
                <button 
                  onClick={() => setSelectedOrder(null)} 
                  className="group p-2.5 rounded-full hover:bg-neutral-100 transition-all duration-200 border border-transparent hover:border-neutral-200"
                >
                  <X className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-neutral-50/30">
              <div className="p-8 space-y-8">
                
                {/* Top Section: Customer & Logistics */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Customer Card */}
                  <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                        <User className="w-5 h-5 text-neutral-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Customer</h3>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <p className="text-xl font-medium text-neutral-900">{selectedOrder.customerName}</p>
                        <p className="text-sm text-neutral-400 mt-1">Verified Customer</p>
                      </div>
                      
                      <div className="space-y-3 pt-4 border-t border-neutral-50">
                        <a 
                          href={`mailto:${selectedOrder.customerEmail}`} 
                          className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-white flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 transition-colors">
                            <Mail className="w-4 h-4" />
                          </div>
                          <span className="text-sm text-neutral-600 group-hover:text-neutral-900 font-medium">{selectedOrder.customerEmail}</span>
                        </a>
                        
                        {selectedOrder.customerPhone && (
                          <a 
                            href={`tel:${selectedOrder.customerPhone}`} 
                            className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-neutral-50 group-hover:bg-white flex items-center justify-center text-neutral-400 group-hover:text-neutral-900 transition-colors">
                              <Phone className="w-4 h-4" />
                            </div>
                            <span className="text-sm text-neutral-600 group-hover:text-neutral-900 font-medium">{selectedOrder.customerPhone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pickup/Logistics Card */}
                  <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-neutral-50 to-transparent rounded-bl-full -mr-8 -mt-8" />
                    
                    <div className="flex items-center gap-3 mb-6 relative">
                      <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100">
                        <Clock className="w-5 h-5 text-neutral-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider">Collection Details</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-8 relative">
                      <div>
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Pickup Date</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-light text-neutral-900">{format(new Date(selectedOrder.pickupDate), 'd')}</span>
                          <span className="text-xl text-neutral-400">{format(new Date(selectedOrder.pickupDate), 'MMM')}</span>
                        </div>
                        <p className="text-sm text-neutral-500 mt-1">{format(new Date(selectedOrder.pickupDate), 'EEEE, yyyy')}</p>
                      </div>

                      <div className="pl-8 border-l border-neutral-100">
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Time Slot</p>
                        <p className="text-2xl font-light text-neutral-900">{selectedOrder.pickupTime}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-black bg-black/[0.04] w-fit px-2 py-1 rounded-md">
                          <CheckCircle className="w-3 h-3" />
                          <span className="font-medium">Confirmed Slot</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Section */}
                <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
                  <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white shadow-lg shadow-neutral-900/20">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Order Items</h3>
                        <p className="text-xs text-neutral-500 font-medium">{selectedOrder.items.length} items in cart</p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-neutral-50">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="p-6 flex items-center gap-6 hover:bg-neutral-50/50 transition-colors group">
                        <div className="w-20 h-20 bg-neutral-100 rounded-2xl border border-neutral-100 overflow-hidden relative shadow-sm group-hover:shadow-md transition-all">
                          <Image src={item.product.image} alt={item.product.name} fill className="object-cover" />
                        </div>
                        
                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-lg font-medium text-neutral-900 truncate pr-4">{item.product.name}</h4>
                            <p className="text-lg font-semibold text-neutral-900">
                              ${(item.quantity * (item.offerPrice ?? item.product.price ?? 0)).toFixed(2)}
                            </p>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-neutral-500 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100 inline-block">
                              {item.product.category}
                            </p>
                            <p className="text-sm text-neutral-500 font-medium">
                              {item.quantity}{" "}
                              <span className="text-neutral-300 mx-1">×</span> $
                              {(item.offerPrice ?? item.product.price ?? 0).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-neutral-50/50 px-8 py-6 border-t border-neutral-100">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-sm text-neutral-500">Total Amount</p>
                        <p className="text-xs text-neutral-400">Including taxes</p>
                      </div>
                      <div className="text-right">
                        <span className="text-4xl font-light tracking-tight text-neutral-900">${selectedOrder.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-8 py-6 border-t border-neutral-100 bg-white z-10 shrink-0">
              <div className="flex gap-4">
                {selectedOrder.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => updateOrderStatus(selectedOrder.id, 'confirmed')} 
                      className="flex-[2] py-4 bg-neutral-900 text-white rounded-2xl font-medium hover:bg-neutral-800 transition-all shadow-xl shadow-neutral-900/20 text-base flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Confirm Order
                    </button>
                    <button 
                      onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')} 
                      className="flex-1 py-4 bg-white border border-black/10 text-black/55 rounded-2xl font-medium hover:bg-black/[0.04] transition-colors"
                    >
                      Cancel Order
                    </button>
                  </>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <button 
                    onClick={() => updateOrderStatus(selectedOrder.id, 'ready')} 
                    className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2"
                  >
                    <Package className="w-5 h-5" />
                    Mark Ready for Pickup
                  </button>
                )}
                {selectedOrder.status === 'ready' && (
                  <button 
                    onClick={() => updateOrderStatus(selectedOrder.id, 'collected')} 
                    className="w-full py-4 bg-black text-white rounded-2xl font-medium hover:bg-black transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Mark as Collected
                  </button>
                )}
                {['collected', 'cancelled'].includes(selectedOrder.status) && (
                  <button 
                    onClick={() => setDeleteConfirm({ isOpen: true, orderId: selectedOrder.id })} 
                    className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-medium hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Move to Bin
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.isBulk ? `Delete ${selectedIds.size} Orders` : "Delete Order"}
        message="Are you sure? This will move the selected order(s) to the bin."
        confirmText="Delete"
        variant="danger"
        onConfirm={deleteOrder}
        onCancel={() => setDeleteConfirm({ isOpen: false, orderId: null, isBulk: false })}
      />
    </PageContainer>
  );
}

export default function OrdersPage() {
  return (
    <AccessControl allowedRoles={['head_admin', 'admin']}>
      <Suspense fallback={null}>
        <OrdersContent />
      </Suspense>
    </AccessControl>
  );
}
