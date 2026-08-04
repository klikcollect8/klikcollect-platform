"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Product } from "@/types";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useSignInModal } from "./SignInModalProvider";
import { useWishlist } from "@/lib/hooks/useWishlist";
import { useToast } from "./ToastProvider";

interface WishlistButtonProps {
  product: Product;
  showToast?: (
    message: string,
    type: "success" | "error" | "info",
    options?: { actionHref?: string; actionLabel?: string },
  ) => void;
}

export default function WishlistButton({
  product,
  showToast,
}: WishlistButtonProps) {
  const { isSignedIn } = useUserAuth();
  const { showSignInModal } = useSignInModal();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const toast = useToast();
  const notify = showToast ?? toast.showToast;

  const isWishlisted = isInWishlist(product.id);

  const toggleWishlist = async () => {
    if (!isSignedIn) {
      showSignInModal("Please sign in to save items");
      return;
    }

    try {
      if (isWishlisted) {
        await removeFromWishlist(product.id);
        notify("Removed from Saved", "info");
      } else {
        await addToWishlist(product);
        notify("Saved for later", "success", {
          actionHref: "/saved",
          actionLabel: "View Saved →",
        });
      }
    } catch {
      notify("Failed to update Saved", "error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={toggleWishlist}
        className="inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
        aria-label={isWishlisted ? "Remove from Saved" : "Save for later"}
      >
        <Heart
          className={`h-4 w-4 ${isWishlisted ? "fill-black text-black" : ""}`}
          strokeWidth={1.5}
        />
        {isWishlisted ? "Saved for later" : "Save for later"}
      </button>
      {isWishlisted ? (
        <Link
          href="/saved"
          className="text-[13px] text-black/40 underline underline-offset-4 decoration-black/15 transition-colors hover:text-black hover:decoration-black"
        >
          View Saved →
        </Link>
      ) : null}
    </div>
  );
}
