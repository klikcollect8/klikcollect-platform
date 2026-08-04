"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays } from "date-fns";
import { CreditCard, Smartphone } from "lucide-react";
import { CartItem } from "@/types";
import { useToast } from "@/components/ToastProvider";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useCart } from "@/lib/hooks/useCart";
import { formatPrice } from "@/lib/currency";
import { openPaystackAccessCode } from "@/lib/paystack/inline";
import {
  isValidKenyaMpesaPhone,
  normalizeKenyaPhone,
} from "@/lib/paystack/phone";
import ThemeSelect from "@/components/ui/ThemeSelect";
import { resolveProductImage } from "@/lib/product-image";

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  pickupDate: z.string().min(1, "Pickup date is required"),
  pickupTime: z.string().min(1, "Pickup time is required"),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;
type PayMethod = "stripe_card" | "mpesa";

export default function Checkout() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isSignedIn, loading: authLoading, user } = useUserAuth();
  const { cartItems, loading: cartLoading, clearCart } = useCart();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const [submitting, setSubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("stripe_card");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [payState, setPayState] = useState<
    "idle" | "starting" | "awaiting_auth" | "verifying" | "success" | "failed"
  >("idle");
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const [deliveryMinor, setDeliveryMinor] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      pickupDate: "",
      pickupTime: "",
    },
  });

  const pickupDate = watch("pickupDate");
  const pickupTime = watch("pickupTime");

  useEffect(() => {
    if (authLoading || cartLoading) return;
    if (!isSignedIn) {
      router.replace("/sign-in?redirect=/checkout");
      return;
    }
    if (isSignedIn && user) {
      setValue("customerName", user.fullName || user.email?.split("@")[0] || "");
      setValue("customerEmail", user.email || "");
    }
  }, [authLoading, cartLoading, isSignedIn, user, setValue, router]);

  useEffect(() => {
    if (authLoading || cartLoading || !isSignedIn) return;
    const timer = setTimeout(() => {
      const hasItems =
        (cartItems && cartItems.length > 0) ||
        (() => {
          try {
            const stored = localStorage.getItem("cart");
            const parsed = stored ? JSON.parse(stored) : [];
            return Array.isArray(parsed) && parsed.length > 0;
          } catch {
            return false;
          }
        })();
      if (!hasItems) {
        showToastRef.current("Your cart is empty", "info");
        router.push("/");
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [authLoading, cartLoading, isSignedIn, cartItems, router]);

  // Load delivery fee quote (pickup default = 0)
  useEffect(() => {
    fetch("/api/payments/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ areaKey: "pickup", fulfilment: "pickup" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j.data?.deliveryMinor === "number") {
          setDeliveryMinor(j.data.deliveryMinor);
        }
      })
      .catch(() => {});
  }, []);

  const displayCartItems = (() => {
    const raw =
      cartItems && cartItems.length > 0
        ? cartItems
        : !cartLoading && typeof window !== "undefined"
          ? (() => {
              try {
                const stored = localStorage.getItem("cart");
                if (stored) {
                  const parsed = JSON.parse(stored);
                  return Array.isArray(parsed) ? parsed : [];
                }
              } catch {
                /* ignore */
              }
              return [];
            })()
          : [];

    const valid = raw.filter(
      (item): item is CartItem =>
        !!item &&
        typeof item === "object" &&
        !!item.product?.id &&
        typeof item.quantity === "number" &&
        (typeof item.offerPrice === "number" ||
          typeof item.product.price === "number"),
    );
    const byKey = new Map<string, CartItem>();
    for (const item of valid) {
      const key = item.offerId || item.product.id;
      const prev = byKey.get(key);
      if (prev) {
        byKey.set(key, { ...prev, quantity: prev.quantity + item.quantity });
      } else {
        byKey.set(key, item);
      }
    }
    return [...byKey.values()];
  })();

  const unitPrice = (item: CartItem) =>
    item.offerPrice ?? item.product.price ?? 0;
  const subtotal = displayCartItems.reduce(
    (sum, item) => sum + unitPrice(item) * item.quantity,
    0,
  );
  const deliveryMajor = deliveryMinor / 100;
  const grandTotal = subtotal + deliveryMajor;

  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i + 1);
    return format(date, "yyyy-MM-dd");
  });
  const timeSlots = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];

  const pollVerify = async (reference: string, provider: string) => {
    setPayState("verifying");
    setPayMessage("Confirming payment…");
    for (let i = 0; i < 24; i++) {
      const res = await fetch(
        `/api/payments/verify?reference=${encodeURIComponent(reference)}&provider=${encodeURIComponent(provider)}`,
      );
      const j = await res.json();
      if (j.data?.status === "success" && j.data?.receiptPublicId) {
        setPayState("success");
        if (typeof clearCart === "function") await clearCart();
        showToast("Payment successful", "success");
        router.push(`/account/receipts/${j.data.receiptPublicId}`);
        return true;
      }
      if (j.data?.status === "success") {
        setPayState("success");
        if (typeof clearCart === "function") await clearCart();
        showToast("Payment successful", "success");
        router.push("/account/orders");
        return true;
      }
      if (
        j.data?.status &&
        !["success", "pending", "ongoing", "processing", "queued", "open"].includes(
          String(j.data.status),
        )
      ) {
        break;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    return false;
  };

  const onSubmit = async (values: CheckoutValues) => {
    const currentCartItems =
      cartItems && cartItems.length > 0 ? cartItems : displayCartItems;
    if (!currentCartItems.length) {
      showToast("Your cart is empty. Please add items before checkout.", "error");
      return;
    }

    if (payMethod === "mpesa") {
      const phone = mpesaPhone.trim() || values.customerPhone;
      if (!isValidKenyaMpesaPhone(phone)) {
        showToast("Enter a valid M-Pesa number (e.g. 07XX or +2547XX)", "error");
        return;
      }
    }

    setSubmitting(true);
    setPayState("starting");
    setPayMessage("Creating order…");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, items: currentCartItems }),
      });
      const data = await response.json();

      if (!response.ok || !(data.id || data.data?.[0]?.id || data.data?.id)) {
        setPayState("failed");
        showToast(
          data.error?.message || data.error || "Failed to place order.",
          "error",
        );
        return;
      }

      const orderId = data.id || data.data?.[0]?.id || data.data?.id;
      const orderPublicId =
        data.public_id || data.data?.[0]?.id || data.data?.public_id || orderId;
      const orderIds: string[] = Array.isArray(data.orderIds)
        ? data.orderIds.map(String)
        : Array.isArray(data.data)
          ? data.data.map((o: { id?: string }) => String(o.id)).filter(Boolean)
          : orderPublicId
            ? [String(orderPublicId)]
            : [];
      const serverTotalMinor =
        Number(data.totalMinor) || Math.round(Number(grandTotal) * 100);

      const provider = payMethod === "mpesa" ? "paystack" : "stripe";
      const method = payMethod === "mpesa" ? "mpesa" : "card";
      const phoneForPay =
        payMethod === "mpesa"
          ? normalizeKenyaPhone(mpesaPhone.trim() || values.customerPhone)
          : null;

      setPayMessage(
        provider === "stripe" ? "Opening Stripe Checkout…" : "Starting M-Pesa…",
      );

      const payRes = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.customerEmail,
          amountMinor: serverTotalMinor + deliveryMinor,
          orderPublicId,
          orderIds,
          method,
          provider,
          phone: phoneForPay,
          areaKey: "pickup",
          collectHub: "Westlands",
          lineItems: currentCartItems.map((item) => ({
            name: item.product?.name,
            quantity: item.quantity,
            price: item.offerPrice ?? item.product?.price,
          })),
        }),
      });
      const payJson = await payRes.json();

      if (!payRes.ok || !payJson.data) {
        setPayState("failed");
        setPayMessage(payJson.error || "Payment init failed");
        showToast(payJson.error || "Payment init failed", "error");
        return;
      }

      if (payJson.data.offline) {
        setPayState("failed");
        setPayMessage(payJson.data.message || "Payment provider not configured");
        showToast("Payment keys missing", "error");
        return;
      }

      // Stripe → hosted Checkout
      if (payJson.data.provider === "stripe" && payJson.data.checkoutUrl) {
        setPayState("awaiting_auth");
        window.location.href = payJson.data.checkoutUrl;
        return;
      }

      // Paystack M-Pesa / card
      const { accessCode, authorizationUrl, reference } = payJson.data;
      if (accessCode) {
        setPayState("awaiting_auth");
        setPayMessage("Complete payment in the popup…");
        try {
          await openPaystackAccessCode(accessCode);
          const ok = await pollVerify(reference, "paystack");
          if (!ok) {
            setPayState("failed");
            setPayMessage("Payment not confirmed yet. Check your orders shortly.");
          }
        } catch {
          if (authorizationUrl) {
            window.location.href = authorizationUrl;
            return;
          }
          setPayState("failed");
          setPayMessage("Payment cancelled or failed");
        }
        return;
      }

      if (authorizationUrl) {
        window.location.href = authorizationUrl;
        return;
      }

      setPayState("failed");
      setPayMessage("No payment URL returned");
    } catch (e) {
      setPayState("failed");
      setPayMessage(e instanceof Error ? e.message : "Checkout failed");
      showToast("Checkout failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || cartLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
          Loading
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] pb-20 pt-8">
      <div className="mx-auto grid max-w-[1100px] gap-10 px-5 lg:grid-cols-[1fr_360px] lg:px-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">
            Checkout
          </p>
          <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.4rem)] font-medium tracking-tight">
            Pay &amp; collect
          </h1>
          <p className="mt-2 max-w-lg text-[14px] text-black/50">
            Card via Stripe, or M-Pesa via Paystack. Vendor payouts release after
            pickup.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-10">
            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">Contact</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-[12px] text-black/45">
                    Full name
                  </span>
                  <input
                    {...register("customerName")}
                    className="w-full border border-black/10 bg-transparent px-3 py-3 text-[15px] outline-none focus:border-black/40"
                  />
                  {errors.customerName ? (
                    <span className="mt-1 block text-[12px] text-red-600">
                      {errors.customerName.message}
                    </span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-black/45">
                    Email
                  </span>
                  <input
                    type="email"
                    {...register("customerEmail")}
                    className="w-full border border-black/10 bg-transparent px-3 py-3 text-[15px] outline-none focus:border-black/40"
                  />
                  {errors.customerEmail ? (
                    <span className="mt-1 block text-[12px] text-red-600">
                      {errors.customerEmail.message}
                    </span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-black/45">
                    Phone
                  </span>
                  <input
                    {...register("customerPhone")}
                    className="w-full border border-black/10 bg-transparent px-3 py-3 text-[15px] outline-none focus:border-black/40"
                  />
                  {errors.customerPhone ? (
                    <span className="mt-1 block text-[12px] text-red-600">
                      {errors.customerPhone.message}
                    </span>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">Pickup</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-black/45">
                    Date
                  </span>
                  <ThemeSelect
                    value={pickupDate}
                    onValueChange={(v) =>
                      setValue("pickupDate", v, { shouldValidate: true })
                    }
                    options={availableDates.map((d) => ({
                      value: d,
                      label: format(new Date(d), "EEE d MMM"),
                    }))}
                    placeholder="Select date"
                    fullWidth
                  />
                  <input type="hidden" {...register("pickupDate")} />
                  {errors.pickupDate ? (
                    <span className="mt-1 block text-[12px] text-red-600">
                      {errors.pickupDate.message}
                    </span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-black/45">
                    Time
                  </span>
                  <ThemeSelect
                    value={pickupTime}
                    onValueChange={(v) =>
                      setValue("pickupTime", v, { shouldValidate: true })
                    }
                    options={timeSlots.map((t) => ({ value: t, label: t }))}
                    placeholder="Select time"
                    fullWidth
                  />
                  <input type="hidden" {...register("pickupTime")} />
                  {errors.pickupTime ? (
                    <span className="mt-1 block text-[12px] text-red-600">
                      {errors.pickupTime.message}
                    </span>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">Payment</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPayMethod("stripe_card")}
                  className={`flex items-center gap-3 border px-4 py-4 text-left transition-colors ${
                    payMethod === "stripe_card"
                      ? "border-black bg-black text-white"
                      : "border-black/10 hover:border-black/30"
                  }`}
                >
                  <CreditCard className="h-5 w-5 shrink-0" />
                  <span>
                    <span className="block text-[14px] font-medium">Card</span>
                    <span
                      className={`block text-[12px] ${
                        payMethod === "stripe_card"
                          ? "text-white/60"
                          : "text-black/40"
                      }`}
                    >
                      Stripe Checkout
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("mpesa")}
                  className={`flex items-center gap-3 border px-4 py-4 text-left transition-colors ${
                    payMethod === "mpesa"
                      ? "border-black bg-black text-white"
                      : "border-black/10 hover:border-black/30"
                  }`}
                >
                  <Smartphone className="h-5 w-5 shrink-0" />
                  <span>
                    <span className="block text-[14px] font-medium">M-Pesa</span>
                    <span
                      className={`block text-[12px] ${
                        payMethod === "mpesa"
                          ? "text-white/60"
                          : "text-black/40"
                      }`}
                    >
                      Paystack
                    </span>
                  </span>
                </button>
              </div>

              {payMethod === "mpesa" ? (
                <label className="block">
                  <span className="mb-1.5 block text-[12px] text-black/45">
                    M-Pesa number
                  </span>
                  <input
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    placeholder="07XXXXXXXX"
                    className="w-full border border-black/10 bg-transparent px-3 py-3 text-[15px] outline-none focus:border-black/40"
                  />
                </label>
              ) : (
                <p className="text-[13px] text-black/45">
                  You&apos;ll complete card payment on Stripe&apos;s secure page.
                  Test cards work in test mode.
                </p>
              )}
            </section>

            {payMessage ? (
              <p className="text-[13px] text-black/50">{payMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                payState === "awaiting_auth" ||
                payState === "verifying" ||
                payState === "success"
              }
              className="w-full bg-black py-4 text-[15px] font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:bg-black/30"
            >
              {submitting ||
              payState === "starting" ||
              payState === "awaiting_auth" ||
              payState === "verifying"
                ? payState === "verifying"
                  ? "Confirming…"
                  : payState === "awaiting_auth"
                    ? "Complete payment…"
                    : "Starting…"
                : `Pay ${formatPrice(grandTotal)}`}
            </button>
          </form>
        </div>

        <aside className="h-fit border border-black/10 bg-transparent lg:sticky lg:top-24">
          <div className="border-b border-black/[0.06] px-5 py-4">
            <h2 className="text-[15px] font-medium">Order summary</h2>
          </div>
          <div className="space-y-4 px-5 py-5">
            {displayCartItems.map((item) => (
              <div
                key={item.offerId || item.product.id}
                className="flex gap-3"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-black/[0.03]">
                  {item.product.image ? (
                    <Image
                      src={resolveProductImage(item.product.image)}
                      alt={item.product.name || "Product"}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {item.product.name}
                  </p>
                  <p className="text-[12px] text-black/45">Qty {item.quantity}</p>
                </div>
                <p className="text-[13px] font-medium">
                  {formatPrice(unitPrice(item) * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-black/[0.06] px-5 py-4 text-[13px]">
            <div className="flex justify-between">
              <span className="text-black/45">Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black/45">Delivery</span>
              <span>
                {deliveryMinor > 0 ? formatPrice(deliveryMajor) : "Pickup · free"}
              </span>
            </div>
            <div className="flex justify-between pt-2 text-[15px] font-medium">
              <span>Total</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
