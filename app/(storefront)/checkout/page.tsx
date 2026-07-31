'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CartItem } from '@/types';
import { format, addDays } from 'date-fns';
import { useToast } from '@/components/ToastProvider';
import { useUserAuth } from '@/lib/hooks/useUserAuth';
import { useCart } from '@/lib/hooks/useCart';
import { formatPrice, GIFT_WRAP_PRICE } from '@/lib/currency';
import { Gift, Calendar, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const checkoutSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  customerEmail: z.string().email('Invalid email address'),
  customerPhone: z.string().min(10, 'Valid phone number is required'),
  pickupDate: z.string().min(1, 'Pickup date is required'),
  pickupTime: z.string().min(1, 'Pickup time is required'),
  giftWrap: z.boolean(),
  giftMessage: z.string().optional(),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isSignedIn, loading: authLoading, user } = useUserAuth();
  const { cartItems, loading: cartLoading, clearCart } = useCart();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      pickupDate: '',
      pickupTime: '',
      giftWrap: false,
      giftMessage: '',
    },
  });

  const giftWrap = watch('giftWrap');

  useEffect(() => {
    if (authLoading || cartLoading) return;
    if (!isSignedIn) {
      router.replace('/sign-in?redirect=' + encodeURIComponent('/checkout'));
      return;
    }

    if (isSignedIn && user) {
      const name = user.fullName || user.email?.split("@")[0] || "";
      setValue('customerName', name);
      setValue('customerEmail', user.email || '');
    }
  }, [authLoading, cartLoading, isSignedIn, user, setValue, router]);

  // Check cart emptiness - redirect if empty after loading
  useEffect(() => {
    if (authLoading || cartLoading || !isSignedIn) return;

    const timer = setTimeout(() => {
      const currentCartItems = cartItems || [];
      let fallbackCart: CartItem[] = [];
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('cart') : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            fallbackCart = parsed;
          }
        }
      } catch {
        // Ignore
      }

      const hasItems = currentCartItems.length > 0 || fallbackCart.length > 0;
      if (!hasItems) {
        showToastRef.current('Your cart is empty', 'info');
        router.push('/');
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [authLoading, cartLoading, isSignedIn, cartItems, router]);

  // Get cart items - filter to valid CartItem structure only
  const displayCartItems = (() => {
    const raw = (cartItems && cartItems.length > 0)
      ? cartItems
      : !cartLoading && typeof window !== 'undefined'
        ? (() => {
            try {
              const stored = localStorage.getItem('cart');
              if (stored) {
                const parsed = JSON.parse(stored);
                return Array.isArray(parsed) ? parsed : [];
              }
            } catch {
              // Ignore
            }
            return [];
          })()
        : [];

    return raw.filter(
      (item): item is CartItem =>
        item &&
        typeof item === 'object' &&
        item.product &&
        item.product.id &&
        typeof item.quantity === 'number' &&
        (typeof item.offerPrice === 'number' || typeof item.product.price === 'number')
    );
  })();

  const unitPrice = (item: CartItem) => item.offerPrice ?? item.product.price ?? 0;
  const total = displayCartItems.reduce(
    (sum, item) => sum + unitPrice(item) * item.quantity,
    0,
  );
  const grandTotal = total + (giftWrap ? GIFT_WRAP_PRICE : 0);

  // Generate available dates (next 7 days)
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i + 1);
    return format(date, 'yyyy-MM-dd');
  });

  // Generate available time slots
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  const onSubmit = async (values: CheckoutValues) => {
    const currentCartItems = cartItems && cartItems.length > 0 ? cartItems : displayCartItems;
    if (!currentCartItems || currentCartItems.length === 0) {
      showToast('Your cart is empty. Please add items before checkout.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      // M1/M2 boundary: place order with display-only totals — no tender (Chapter 05).
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          items: currentCartItems,
        }),
      });

      const data = await response.json();

      if (response.ok && (data.id || data.data?.id)) {
        const orderId = data.id || data.data?.id;
        if (typeof clearCart === 'function') await clearCart();
        showToast('Order placed. Totals are display-only until M3 payments.', 'success');
        router.push(`/order-confirmation/${orderId}`);
      } else {
        if (data.details && Array.isArray(data.details)) {
          showToast(data.details.join('. '), 'error');
        } else {
          showToast(data.error?.message || data.error || 'Failed to place order.', 'error');
        }
      }
    } catch (error) {
      console.error('Error placing order:', error);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading state
  if (authLoading || cartLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">Loading</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[12px] uppercase tracking-[0.22em] text-black/40">Redirecting</p>
      </div>
    );
  }

  if (!cartLoading && (!displayCartItems || displayCartItems.length === 0)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f5] px-6 text-center">
        <p className="text-[22px] font-medium tracking-tight">Your bag is empty</p>
        <button
          type="button"
          onClick={() => router.push('/shop')}
          className="mt-8 bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80"
        >
          Continue shopping
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
      <div className="mx-auto w-full max-w-[1600px] px-6 py-12 sm:px-10 sm:py-16 lg:px-14 xl:px-20">
        <div className="mb-12">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.24em] text-black/40">Checkout</p>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-medium tracking-tight text-black">Complete your order</h1>
          <p className="mt-3 text-[16px] text-black/50">Pickup details and contact</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Customer Information */}
              <div className="border border-black/10 bg-transparent overflow-hidden">
                <div className="px-6 py-4 border-b border-black/[0.06] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/[0.04] flex items-center justify-center">
                    <User className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-black">Contact Information</h2>
                    <p className="text-sm text-black/45">We'll use this for order updates</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-black/70 mb-2">Full Name *</label>
                    <input
                      type="text"
                      {...register('customerName')}
                      className={`w-full px-4 py-3 border rounded-none focus:ring-2 outline-none transition-all ${
                        errors.customerName ? 'border-red-500 focus:ring-red-500/20' : 'border-black/12 focus:border-black/40 focus:ring-0'
                      }`}
                      placeholder="John Doe"
                    />
                    {errors.customerName && <p className="mt-1 text-xs text-red-500">{errors.customerName.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black/70 mb-2">Email *</label>
                    <input
                      type="email"
                      {...register('customerEmail')}
                      className={`w-full px-4 py-3 border rounded-none focus:ring-2 outline-none transition-all ${
                        errors.customerEmail ? 'border-red-500 focus:ring-red-500/20' : 'border-black/12 focus:border-black/40 focus:ring-0'
                      }`}
                      placeholder="john@example.com"
                    />
                    {errors.customerEmail && <p className="mt-1 text-xs text-red-500">{errors.customerEmail.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black/70 mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      {...register('customerPhone')}
                      className={`w-full px-4 py-3 border rounded-none focus:ring-2 outline-none transition-all ${
                        errors.customerPhone ? 'border-red-500 focus:ring-red-500/20' : 'border-black/12 focus:border-black/40 focus:ring-0'
                      }`}
                      placeholder="+254 7XX XXX XXX"
                    />
                    {errors.customerPhone && <p className="mt-1 text-xs text-red-500">{errors.customerPhone.message}</p>}
                  </div>
                </div>
              </div>

              {/* Pickup Details */}
              <div className="border border-black/10 bg-transparent overflow-hidden">
                <div className="px-6 py-4 border-b border-black/[0.06] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/[0.04] flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-black">Pickup Details</h2>
                    <p className="text-sm text-black/45">When would you like to collect?</p>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black/70 mb-2">Pickup Date *</label>
                    <select
                      {...register('pickupDate')}
                      className={`w-full px-4 py-3 border rounded-none focus:ring-2 outline-none transition-all bg-white ${
                        errors.pickupDate ? 'border-red-500 focus:ring-red-500/20' : 'border-black/12 focus:border-black/40 focus:ring-0'
                      }`}
                    >
                      <option value="">Select a date</option>
                      {availableDates.map(date => (
                        <option key={date} value={date}>
                          {format(new Date(date), 'EEE, MMM d')}
                        </option>
                      ))}
                    </select>
                    {errors.pickupDate && <p className="mt-1 text-xs text-red-500">{errors.pickupDate.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black/70 mb-2">Pickup Time *</label>
                    <select
                      {...register('pickupTime')}
                      className={`w-full px-4 py-3 border rounded-none focus:ring-2 outline-none transition-all bg-white ${
                        errors.pickupTime ? 'border-red-500 focus:ring-red-500/20' : 'border-black/12 focus:border-black/40 focus:ring-0'
                      }`}
                    >
                      <option value="">Select a time</option>
                      {timeSlots.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    {errors.pickupTime && <p className="mt-1 text-xs text-red-500">{errors.pickupTime.message}</p>}
                  </div>
                </div>
              </div>

              {/* Gift Options */}
              <div className="border border-black/10 bg-transparent overflow-hidden">
                <div className="px-6 py-4 border-b border-black/[0.06] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/[0.04] flex items-center justify-center">
                    <Gift className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-black">Gift Options</h2>
                    <p className="text-sm text-black/45">Add a personal touch</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <label className="flex cursor-pointer items-center gap-3 border border-black/[0.06] p-4 transition-all hover:border-black/20 hover:bg-black/[0.03]">
                    <input
                      type="checkbox"
                      {...register('giftWrap')}
                      className="h-5 w-5 rounded-none border-black/20 text-black focus:ring-0"
                    />
                    <span className="text-black/70">Add gift wrapping</span>
                    <span className="ml-auto font-semibold text-black">{formatPrice(GIFT_WRAP_PRICE)}</span>
                  </label>
                  {giftWrap && (
                    <div>
                      <label className="block text-sm font-medium text-black/70 mb-2">Gift Message (Optional)</label>
                      <textarea
                        {...register('giftMessage')}
                        rows={3}
                        className="w-full px-4 py-3 border border-black/12 rounded-none focus:ring-2 focus:border-black/40 focus:ring-0 outline-none transition-all"
                        placeholder="Add a personal message..."
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Place order — no live tender until M3 */}
              <div className="border border-black/10 bg-transparent overflow-hidden">
                <div className="px-6 py-4 border-b border-black/[0.06]">
                  <h2 className="font-semibold text-black">Place order</h2>
                  <p className="text-sm text-black/45 mt-1">
                    Totals are display-only. Live payment lands at M3.
                  </p>
                </div>
                <div className="p-6">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-black hover:opacity-80 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-none font-semibold transition-all"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                        Placing order…
                      </span>
                    ) : (
                      `Place order · ${formatPrice(grandTotal)}`
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="border border-black/10 bg-transparent overflow-hidden sticky top-24">
              <div className="px-6 py-4 border-b border-black/[0.06]">
                <h2 className="font-semibold text-black">Order Summary</h2>
              </div>
              <div className="p-6 space-y-4">
                {displayCartItems.map((item) => (
                  <div key={item.offerId || item.product.id} className="flex gap-3">
                    <div className="w-14 h-14 rounded-none bg-gray-50 overflow-hidden flex-shrink-0">
                      {item.product.image && (
                        <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-black truncate">{item.product.name}</p>
                      <p className="text-sm text-black/45">Qty: {item.quantity}</p>
                      {(item.vendorName || item.product.vendorName) ? (
                        <p className="text-xs text-black/40 truncate">
                          {item.vendorName || item.product.vendorName}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-sm font-semibold text-black">
                      {formatPrice(unitPrice(item) * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-black/[0.06] space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-black/45">Subtotal</span>
                  <span className="font-medium">{formatPrice(total)}</span>
                </div>
                {giftWrap && (
                  <div className="flex justify-between text-sm">
                    <span className="text-black/45">Gift Wrapping</span>
                    <span className="font-medium">{formatPrice(GIFT_WRAP_PRICE)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Delivery</span>
                  <span className="font-semibold">FREE</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-6">
                  <span>Total</span>
                  <span className="text-black">{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
