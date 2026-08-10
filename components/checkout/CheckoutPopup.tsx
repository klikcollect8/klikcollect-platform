"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  onClose?: () => void;
};

/**
 * @deprecated Checkout is a full page at /checkout.
 * Kept so legacy `openCheckout` listeners can navigate away cleanly.
 */
export default function CheckoutPopup({ onClose }: Props) {
  const router = useRouter();

  useEffect(() => {
    onClose?.();
    router.push("/checkout");
  }, [onClose, router]);

  return null;
}
