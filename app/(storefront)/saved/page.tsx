"use client";

import Link from "next/link";
import Image from "next/image";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useToast } from "@/components/ToastProvider";
import { useSignInModal } from "@/components/SignInModalProvider";
import { resolveProductImage } from "@/lib/product-image";
import { StorePage, StoreHeading } from "@/components/marketplace/StorePage";

export default function SavedPage() {
  const { wishlist, loading, removeFromWishlist } = useWishlist();
  const { isSignedIn } = useUserAuth();
  const { showToast } = useToast();
  const { showSignInModal } = useSignInModal();

  const remove = async (productId: string) => {
    if (!isSignedIn) {
      showSignInModal("Sign in to manage saved items");
      return;
    }
    try {
      await removeFromWishlist(productId);
      showToast("Removed from saved", "success");
    } catch {
      showToast("Could not remove item", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Loading</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <StorePage narrow>
        <div className="border-t border-black/[0.06] py-24 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/35">Saved</p>
          <h1 className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] font-medium tracking-tight">
            Sign in to see saved items
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-black/50">
            Save products while you browse, then come back to choose a vendor and add them to your bag.
          </p>
          <button
            type="button"
            onClick={() => showSignInModal("Sign in to view saved items")}
            className="mt-10 bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80"
          >
            Sign in
          </button>
        </div>
      </StorePage>
    );
  }

  if (wishlist.length === 0) {
    return (
      <StorePage narrow>
        <div className="border-t border-black/[0.06] py-24 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/35">Saved</p>
          <h1 className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] font-medium tracking-tight">
            Nothing saved yet
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-black/50">
            Tap Save for later on a product — it will show up here.
          </p>
          <Link
            href="/shop"
            className="mt-10 inline-flex bg-black px-8 py-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80"
          >
            Browse shop
          </Link>
        </div>
      </StorePage>
    );
  }

  return (
    <StorePage>
      <StoreHeading
        eyebrow="Saved"
        title="Saved for later"
        description={`${wishlist.length} ${wishlist.length === 1 ? "item" : "items"}`}
      />

      <div className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8 xl:gap-y-16">
        {wishlist.map((product) => (
          <article key={product.id} className="group min-w-0">
            <Link href={`/products/${product.id}`} className="block">
              <div className="relative aspect-square overflow-hidden bg-black/[0.03]">
                <Image
                  src={resolveProductImage(product.image)}
                  alt={product.name || "Product"}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes="240px"
                />
              </div>
              <h2 className="mt-3 truncate text-[14px] font-medium tracking-tight">
                {product.name}
              </h2>
              <p className="mt-0.5 truncate text-[12px] text-black/40">{product.category}</p>
            </Link>
            <div className="mt-3 flex items-center justify-between gap-3">
              <Link
                href={`/products/${product.id}`}
                className="text-[12px] text-black/50 underline underline-offset-[4px] decoration-black/15 hover:text-black hover:decoration-black"
              >
                View
              </Link>
              <button
                type="button"
                onClick={() => void remove(product.id)}
                className="text-[12px] text-black/35 transition-colors hover:text-black"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </StorePage>
  );
}
