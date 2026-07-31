"use client";

import { Product } from "@/types";
import Image from "next/image";
import { X, Star, Heart } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useSignInModal } from "./SignInModalProvider";
import { useToast } from "./ToastProvider";
import { resolveProductImage } from "@/lib/product-image";

interface QuickViewProps {
  product: Product;
  onClose: () => void;
  onAddToCart?: (product: Product) => void;
}

export default function QuickView({ product, onClose }: QuickViewProps) {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isSignedIn, loading: authLoading, user } = useUserAuth();
  const { showSignInModal } = useSignInModal();
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const isWishlisted = isInWishlist(product.id);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (authLoading) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (!isSignedIn || !user) {
      showSignInModal("Please sign in to add items to your wishlist");
      return;
    }

    try {
      if (isWishlisted) {
        await removeFromWishlist(product.id);
        showToast("Removed from wishlist", "info");
      } else {
        await addToWishlist(product);
        showToast("Added to wishlist", "success");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update wishlist";
      if (message.includes("signed in") || message.includes("must be signed")) {
        showSignInModal("Please sign in to add items to your wishlist");
      } else {
        showToast(message, "error");
      }
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20 p-0 backdrop-blur-sm animate-in fade-in duration-300 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[70vh] w-full max-h-[85vh] flex-col overflow-hidden bg-white shadow-2xl animate-in slide-in-from-bottom-12 duration-300 ease-out md:h-auto md:max-w-4xl md:flex-row md:rounded-3xl md:zoom-in-95 rounded-t-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-30 rounded-full bg-white/50 p-2 backdrop-blur-md transition-colors hover:bg-white/80 md:hidden"
        >
          <X className="h-4 w-4 text-black/70" />
        </button>

        <div className="relative flex h-56 w-full shrink-0 items-center justify-center border-b border-gray-50 bg-white p-6 md:h-auto md:w-[45%] md:border-b-0 md:border-r md:p-10">
          <div className="relative h-full min-h-[160px] w-full md:min-h-[280px]">
            <Image
              src={resolveProductImage(product.image)}
              alt={product.name}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 45vw"
              priority
            />
          </div>
        </div>

        <div className="flex h-full w-full flex-col md:w-[55%]">
          <div className="flex-1 overflow-y-auto p-5 md:p-10">
            <div className="mb-2 flex items-start justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 md:text-xs">
                {product.category}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="-mr-2 -mt-2 hidden rounded-full p-2 transition-colors hover:bg-gray-50 md:flex"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-black" />
              </button>
            </div>

            <h2 className="mb-4 pr-8 text-lg font-normal leading-tight tracking-tight text-black md:pr-0 md:text-2xl">
              {product.name}
            </h2>

            <p className="mb-6 text-[13px] text-black/45">
              Price depends on the seller you choose on the product page.
            </p>

            <div className="mb-6 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-black text-black" />
              <span className="text-xs font-medium text-black">
                {product.rating?.toFixed(1) || "0.0"}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-400 underline decoration-gray-300 underline-offset-2">
                {product.reviewCount || 0} reviews
              </span>
            </div>

            <p className="mb-6 text-xs font-normal leading-relaxed text-gray-500 md:text-sm">
              {product.description ||
                "Designed with precision and care, this piece exemplifies modern craftsmanship."}
            </p>
          </div>

          <div className="sticky bottom-0 z-20 border-t border-gray-50 bg-white p-4 md:border-none md:p-10 md:pt-0">
            <div className="flex gap-3">
              <Link
                href={`/products/${product.id}`}
                onClick={onClose}
                className="flex h-12 flex-1 items-center justify-center bg-black text-xs font-bold uppercase tracking-widest text-white transition-all hover:opacity-90 active:scale-[0.98] md:text-sm"
              >
                Choose seller
              </Link>
              <button
                type="button"
                onClick={handleWishlistToggle}
                className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
                  isWishlisted
                    ? "border-black bg-black text-white"
                    : "border-gray-200 text-black hover:border-black"
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`}
                  strokeWidth={1.5}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
