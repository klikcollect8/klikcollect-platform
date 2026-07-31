'use client';

import Cart from './Cart';
import { useCart } from '@/lib/hooks/useCart';

interface CartWrapperProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartWrapper({ isOpen, onClose }: CartWrapperProps) {
  const { cartItems, updateQuantity, removeFromCart, addToCart, loading } = useCart();

  if (!isOpen) return null;

  // Only show loading state if it's the initial load (empty cart and loading)
  // Otherwise, let the Cart component handle the UI
  if (loading && cartItems.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex justify-end">
        <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium text-sm">Loading cart...</p>
        </div>
      </div>
    );
  }

  return (
    <Cart
      items={cartItems}
      onUpdateQuantity={updateQuantity}
      onRemoveItem={removeFromCart}
      onAddToCart={addToCart}
      onClose={onClose}
    />
  );
}
