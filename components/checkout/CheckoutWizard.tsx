"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/types";
import { useToast } from "@/components/ToastProvider";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useCart } from "@/lib/hooks/useCart";
import { useSignInModal } from "@/components/SignInModalProvider";
import { formatPrice } from "@/lib/currency";
import { openPaystackAccessCode } from "@/lib/paystack/inline";
import {
  isValidKenyaMpesaPhone,
  normalizeKenyaPhone,
} from "@/lib/paystack/phone";
import CheckoutShell, {
  type CheckoutShellStep,
} from "@/components/checkout/CheckoutShell";
import OrderSummaryBlock from "@/components/checkout/OrderSummaryBlock";
import PickupCollectStep from "@/components/checkout/PickupCollectStep";
import PhoneField, {
  toKenyaPhoneE164,
} from "@/components/checkout/PhoneField";
import { type TimingMode } from "@/components/checkout/SameDayTiming";
import {
  PICKUP_FLOW,
  fulfilmentLabel,
  resolveAreaLabel,
  type CheckoutStepId,
  type FulfilmentMethod,
} from "@/components/checkout/fulfilment";
import { cartVendorIds } from "@/lib/checkout/cart-vendors";
import {
  defaultPayMethod,
  getPayMethodMeta,
  isMpesaPayMethod,
  isPaystackHostedMethod,
  type PayMethod,
} from "@/components/checkout/payment-methods";
import PaymentStep from "@/components/checkout/PaymentStep";
import type { CheckoutVendor, CollectMode } from "@/lib/checkout/types";
import {
  quoteClassicPickup,
  quoteHybridConsolidate,
  type DeliveryQuote,
} from "@/lib/checkout/delivery-pricing";
import {
  formatSlotLabel,
  intersectWindows,
  resolveTodayWindow,
  todayDateString,
} from "@/lib/checkout/same-day-slots";

const fieldClass =
  "w-full border-b border-black/15 bg-transparent py-3 text-[17px] outline-none transition-colors focus:border-black/40 placeholder:text-black/25";

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(9, "Enter a valid mobile number"),
  pickupDate: z.string().min(1, "Date is required"),
  pickupTime: z.string().min(1, "Time is required"),
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

function dedupeCart(raw: CartItem[]): CartItem[] {
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
}

/**
 * Full-page stepped checkout — click & collect only (receipt-based).
 * Flow: collect → contact → pay
 */
export default function CheckoutWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { isSignedIn, loading: authLoading, user } = useUserAuth();
  const { showSignInModal } = useSignInModal();
  const { cartItems, loading: cartLoading, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStepId>("collect");
  const [stepError, setStepError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const cancelled = searchParams.get("cancelled") === "1";

  const fulfilment = "pickup" as FulfilmentMethod;

  // Delivery fields kept empty (pickup-only checkout)
  const deliveryArea: string = "";
  const areaOther: string = "";
  const building: string = "";
  const street: string = "";
  const landmark: string = "";
  const deliveryLabel: string = "";
  const deliveryLat: number | null = null;
  const deliveryLng: number | null = null;
  const gateCode: string = "";
  const deliveryNote: string = "";

  // Pickup / hybrid
  const [collectMode, setCollectMode] = useState<CollectMode>("classic");
  const [hubVendorId, setHubVendorId] = useState<string | null>(null);
  const [checkoutVendors, setCheckoutVendors] = useState<CheckoutVendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);

  const [timingMode, setTimingMode] = useState<TimingMode>("asap");
  const [deliveryMinor, setDeliveryMinor] = useState(0);
  const [activeQuote, setActiveQuote] = useState<DeliveryQuote | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [payConfig, setPayConfig] = useState({
    stripeReady: false,
    paystackReady: false,
  });
  const [payState, setPayState] = useState<
    "idle" | "starting" | "awaiting_auth" | "verifying" | "success" | "failed"
  >("idle");
  const [payMessage, setPayMessage] = useState<string | null>(null);

  const today = todayDateString();

  const flow = useMemo((): CheckoutStepId[] => [...PICKUP_FLOW], []);

  const stepIndex = Math.max(0, flow.indexOf(step));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      pickupDate: today,
      pickupTime: "",
    },
    mode: "onChange",
  });

  const pickupDate = watch("pickupDate");
  const pickupTime = watch("pickupTime");
  const customerName = watch("customerName");
  const customerEmail = watch("customerEmail");
  const customerPhone = watch("customerPhone");

  const displayCartItems = useMemo(() => {
    if (cartItems?.length) return dedupeCart(cartItems);
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("cart");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? dedupeCart(parsed) : [];
    } catch {
      return [];
    }
  }, [cartItems]);

  const unitPrice = (item: CartItem) =>
    item.offerPrice ?? item.product.price ?? 0;
  const subtotal = displayCartItems.reduce(
    (sum, item) => sum + unitPrice(item) * item.quantity,
    0,
  );
  const deliveryMajor = 0;
  const grandTotal = subtotal + deliveryMajor;

  const paymentsAvailable = payConfig.stripeReady || payConfig.paystackReady;
  const payMeta = getPayMethodMeta(payMethod);

  const areaLabel = resolveAreaLabel(deliveryArea, areaOther);
  const composedAddress = [building, street || deliveryLabel, landmark]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  const areaKey =
    fulfilment === "delivery"
      ? deliveryArea === "other"
        ? "other"
        : deliveryArea
      : "pickup";

  const hubVendor =
    checkoutVendors.find((v) => v.vendorId === hubVendorId) ||
    checkoutVendors[0] ||
    null;

  const collectHubLabel = (() => {
    if (fulfilment !== "pickup") return "";
    if (collectMode === "hybrid" && hubVendor) {
      return `Hybrid → ${hubVendor.name}`;
    }
    if (checkoutVendors.length === 1) return checkoutVendors[0]!.name;
    return checkoutVendors.map((v) => v.name).join(" · ");
  })();

  const dayWindow = useMemo(() => {
    const targets =
      fulfilment === "pickup" && collectMode === "hybrid" && hubVendor
        ? [hubVendor]
        : checkoutVendors;
    const windows = targets.map((v) =>
      resolveTodayWindow(v.weekly, v.holidays),
    );
    return intersectWindows(windows);
  }, [checkoutVendors, fulfilment, collectMode, hubVendor]);

  const locationReady =
    (deliveryLat != null && deliveryLng != null
      ? true
      : street.trim().length >= 4 ||
        building.trim().length >= 2 ||
        deliveryLabel.trim().length >= 4) &&
    (deliveryArea === "other"
      ? areaOther.trim().length >= 2
      : !!deliveryArea) &&
    !!pickupDate &&
    !!pickupTime &&
    !dayWindow.isClosed;

  const canContinue = useMemo(() => {
    switch (step) {
      case "method":
        return fulfilment === "pickup" || fulfilment === "delivery";
      case "location":
        return locationReady;
      case "collect":
        if (!checkoutVendors.length) return false;
        if (collectMode === "hybrid") return !!hubVendorId;
        return true;
      case "contact": {
        const phone = toKenyaPhoneE164(customerPhone);
        return (
          customerName.trim().length >= 2 &&
          !!customerEmail &&
          phone.replace(/\D/g, "").length >= 12
        );
      }
      case "payment":
        if (!paymentsAvailable || !payMethod) return false;
        if (isMpesaPayMethod(payMethod)) {
          return isValidKenyaMpesaPhone(
            mpesaPhone.trim() || toKenyaPhoneE164(customerPhone),
          );
        }
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  }, [
    step,
    fulfilment,
    locationReady,
    checkoutVendors.length,
    collectMode,
    hubVendorId,
    pickupDate,
    pickupTime,
    dayWindow.isClosed,
    customerName,
    customerEmail,
    customerPhone,
    paymentsAvailable,
    payMethod,
    mpesaPhone,
  ]);

  const goToCart = useCallback(() => {
    router.push("/cart");
  }, [router]);

  useEffect(() => {
    if (authLoading || cartLoading) return;
    if (!isSignedIn) {
      // Modal on a public page — avoid /sign-in ↔ /checkout redirect loop.
      showSignInModal("Sign in to checkout", { redirect: "/checkout" });
      router.replace("/cart");
      return;
    }
    if (user) {
      setValue("customerName", user.fullName || user.email?.split("@")[0] || "");
      setValue("customerEmail", user.email || "");
    }
  }, [
    authLoading,
    cartLoading,
    isSignedIn,
    user,
    setValue,
    router,
    showSignInModal,
  ]);

  useEffect(() => {
    if (cancelled) {
      showToast("Payment cancelled — you can try again.", "error");
    }
  }, [cancelled, showToast]);

  // Load vendor details for cart
  useEffect(() => {
    const ids = cartVendorIds(displayCartItems);
    if (!ids.length) {
      setCheckoutVendors([]);
      return;
    }
    let cancelled = false;
    setVendorsLoading(true);
    fetch("/api/checkout/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorIds: ids }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list = (j.data || []) as CheckoutVendor[];
        // Fallback names from cart if API sparse
        const enriched = ids.map((id) => {
          const found = list.find((v) => v.vendorId === id);
          if (found) return found;
          const fromCart = displayCartItems.find((i) => i.vendorId === id);
          return {
            vendorId: id,
            name: fromCart?.vendorName || id,
            neighbourhood: fromCart?.neighbourhood || null,
            address: null,
            city: null,
            phone: null,
            lat: null,
            lng: null,
            storeName: null,
            openNow: false,
            todayLabel: "Hours unavailable",
            weekly: [],
            holidays: [],
          } satisfies CheckoutVendor;
        });
        setCheckoutVendors(enriched);
        setHubVendorId((prev) => prev || enriched[0]?.vendorId || null);
      })
      .catch(() => {
        if (!cancelled) setCheckoutVendors([]);
      })
      .finally(() => {
        if (!cancelled) setVendorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [displayCartItems]);

  // Pickup-only — no delivery fee
  useEffect(() => {
    setDeliveryMinor(0);
    setActiveQuote(null);
  }, []);

  useEffect(() => {
    fetch("/api/payments/config")
      .then(async (r) => {
        if (!r.ok) throw new Error(`Config ${r.status}`);
        return r.json();
      })
      .then((j) => {
        const stripeReady = !!j.data?.stripe?.ready;
        const paystackReady = !!j.data?.paystack?.ready;
        setPayConfig({ stripeReady, paystackReady });
        setConfigError(null);
        setPayMethod(
          (prev) => prev ?? defaultPayMethod(stripeReady, paystackReady),
        );
        if (!stripeReady && !paystackReady) {
          setConfigError("Payment keys are not configured.");
        }
      })
      .catch(() => {
        setConfigError("Could not load payment options. Refresh and try again.");
        setPayConfig({ stripeReady: false, paystackReady: false });
      });
  }, []);

  useEffect(() => {
    if (!flow.includes(step)) setStep(flow[0] || "collect");
  }, [flow, step]);

  // Ensure same-day date + ASAP pickup time (short checkout)
  useEffect(() => {
    if (pickupDate !== today) setValue("pickupDate", today);
    if (!pickupTime) {
      setValue("pickupTime", "asap", { shouldValidate: true });
    }
  }, [pickupDate, pickupTime, today, setValue]);

  const goNext = async () => {
    setStepError(null);
    if (step === "method") {
      setStep("collect");
      return;
    }
    if (step === "location") {
      setStep("collect");
      return;
    }
    if (step === "collect" && !canContinue) {
      setStepError(
        collectMode === "hybrid"
          ? "Choose which shop you’ll collect from"
          : "Shop details are still loading",
      );
      return;
    }
    if (step === "contact") {
      const ok = await trigger([
        "customerName",
        "customerEmail",
        "customerPhone",
      ]);
      if (!ok || !canContinue) {
        setStepError("Fill in your contact details");
        return;
      }
    }
    if (step === "payment" && !canContinue) {
      setStepError(
        isMpesaPayMethod(payMethod)
          ? "Enter a valid M-Pesa number"
          : "Choose a payment method",
      );
      return;
    }
    const idx = flow.indexOf(step);
    if (idx >= 0 && idx < flow.length - 1) {
      setStep(flow[idx + 1]!);
    }
  };

  const goBack = () => {
    setStepError(null);
    const idx = flow.indexOf(step);
    if (idx > 0) setStep(flow[idx - 1]!);
  };

  const pollVerify = async (reference: string, provider: string) => {
    for (let i = 0; i < 24; i++) {
      setPayState("verifying");
      setPayMessage("Confirming payment…");
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, provider }),
      });
      const j = await res.json();
      if (j.data?.status === "success" || j.data?.paid) {
        setPayState("success");
        setPayMessage("Payment confirmed");
        await clearCart();
        showToast("Order placed", "success");
        router.push("/account/orders");
        return true;
      }
      if (
        j.data?.status &&
        ![
          "success",
          "pending",
          "ongoing",
          "processing",
          "queued",
          "open",
        ].includes(String(j.data.status))
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
      showToast("Your cart is empty.", "error");
      return;
    }
    if (!fulfilment) {
      setStep("collect");
      return;
    }
    if (!payMethod) {
      setStep("payment");
      return;
    }

    const phoneE164 = toKenyaPhoneE164(values.customerPhone);
    if (isMpesaPayMethod(payMethod)) {
      const phone = mpesaPhone.trim() || phoneE164;
      if (!isValidKenyaMpesaPhone(phone)) {
        setStep("payment");
        showToast("Enter a valid M-Pesa number", "error");
        return;
      }
    }

    setSubmitting(true);
    setPayState("starting");
    setPayMessage("Creating order…");

    const deliveryAddressFull = [
      composedAddress,
      areaLabel,
      gateCode.trim() ? `Gate: ${gateCode.trim()}` : "",
      deliveryNote.trim() ? `Note: ${deliveryNote.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const pickupFulfilmentNote =
      fulfilment === "pickup"
        ? collectMode === "hybrid"
          ? `Hybrid consolidate → ${hubVendor?.name || collectHubLabel}`
          : `Classic C&C · ${collectHubLabel}`
        : undefined;

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          customerPhone: phoneE164,
          pickupDate: today,
          items: currentCartItems.map((item) => ({ ...item, fulfilment })),
          fulfilment,
          collectHub:
            fulfilment === "pickup" ? collectHubLabel : undefined,
          deliveryAddress:
            fulfilment === "delivery" ? deliveryAddressFull : undefined,
          areaKey,
          pickupNote: pickupFulfilmentNote,
          building: fulfilment === "delivery" ? building.trim() : undefined,
          street:
            fulfilment === "delivery"
              ? street.trim() || deliveryLabel.trim()
              : undefined,
          landmark: fulfilment === "delivery" ? landmark.trim() : undefined,
          gateCode: fulfilment === "delivery" ? gateCode.trim() : undefined,
          deliveryNote:
            fulfilment === "delivery" ? deliveryNote.trim() : undefined,
          deliveryLat: fulfilment === "delivery" ? deliveryLat : undefined,
          deliveryLng: fulfilment === "delivery" ? deliveryLng : undefined,
          collectMode: fulfilment === "pickup" ? collectMode : undefined,
          hubVendorId:
            fulfilment === "pickup" ? hubVendorId || undefined : undefined,
        }),
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
          ? data.data
              .map((o: { id?: string }) => String(o.id))
              .filter(Boolean)
          : orderPublicId
            ? [String(orderPublicId)]
            : [];
      const serverTotalMinor =
        Number(data.totalMinor) || Math.round(Number(grandTotal) * 100);

      const meta = getPayMethodMeta(payMethod);
      const provider = meta?.rail === "paystack" ? "paystack" : "stripe";
      const method = meta?.apiMethod ?? "card";
      const phoneForPay = isMpesaPayMethod(payMethod)
        ? normalizeKenyaPhone(mpesaPhone.trim() || phoneE164)
        : null;

      setPayMessage(
        provider === "stripe"
          ? "Opening Stripe Checkout…"
          : isMpesaPayMethod(payMethod)
            ? "Starting M-Pesa…"
            : "Opening Paystack…",
      );

      const payRes = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.customerEmail,
          amountMinor: Math.max(
            serverTotalMinor,
            Math.round(subtotal * 100) + deliveryMinor,
          ),
          orderPublicId,
          orderIds,
          method,
          provider,
          phone: phoneForPay,
          areaKey,
          collectHub: fulfilment === "pickup" ? collectHubLabel : null,
          fulfilment,
          deliveryMinor,
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
        showToast("Payment keys missing", "error");
        return;
      }
      if (payJson.data.provider === "stripe" && payJson.data.checkoutUrl) {
        setPayState("awaiting_auth");
        window.location.href = payJson.data.checkoutUrl;
        return;
      }

      const { accessCode, authorizationUrl, reference } = payJson.data;

      // Hosted Paystack for card / bank / USSD (full-page redirect)
      if (isPaystackHostedMethod(payMethod) && authorizationUrl) {
        setPayState("awaiting_auth");
        window.location.href = authorizationUrl;
        return;
      }

      // M-Pesa: Inline STK, then verify; fall back to hosted URL
      if (accessCode && isMpesaPayMethod(payMethod)) {
        setPayState("awaiting_auth");
        setPayMessage("Complete M-Pesa on your phone…");
        try {
          const inline = await openPaystackAccessCode(accessCode);
          if (!inline.ok) {
            if (authorizationUrl) {
              window.location.href = authorizationUrl;
              return;
            }
            setPayState("failed");
            setPayMessage(
              inline.reason === "cancelled"
                ? "Payment cancelled"
                : inline.message || "Payment failed",
            );
            return;
          }
          const ok = await pollVerify(reference, "paystack");
          if (!ok) {
            setPayState("failed");
            setPayMessage(
              "Payment not confirmed yet. Check your orders shortly.",
            );
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

  const placeLabel = (() => {
    if (payState === "verifying") return "Confirming…";
    if (payState === "awaiting_auth") return "Complete payment…";
    if (submitting || payState === "starting") return "Placing order…";
    return "Place order";
  })();

  const whenSummary =
    timingMode === "asap"
      ? `ASAP today · ~${activeQuote?.etaMinutes || 35} min`
      : pickupDate && pickupTime
        ? `Today · ${formatSlotLabel(pickupTime)}`
        : "—";

  const heading = (title: string, sub: string) => (
    <header className="max-w-xl">
      <h2 className="text-[clamp(1.45rem,3.6vw,1.85rem)] font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-black/45">{sub}</p>
    </header>
  );

  const flowLabel =
    fulfilment === "delivery"
      ? "Delivery"
      : fulfilment === "pickup"
        ? "Click & collect"
        : "Checkout";

  const shellSteps: CheckoutShellStep[] = useMemo(() => {
    const labels: Record<string, string> = {
      method: "Method",
      location: "Address",
      collect: "Collect",
      when: "When",
      contact: "Details",
      payment: "Pay",
      review: "Review",
    };
    return flow.map((id) => ({ id, label: labels[id] || id }));
  }, [flow]);

  const classicQuote = quoteClassicPickup();
  const hybridQuote = useMemo(() => {
    const shopCoords = checkoutVendors
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => ({ lat: v.lat as number, lng: v.lng as number }));
    const idx = Math.max(
      0,
      checkoutVendors.findIndex((v) => v.vendorId === hubVendorId),
    );
    return quoteHybridConsolidate(shopCoords, idx);
  }, [checkoutVendors, hubVendorId]);

  const primaryDisabled =
    step === "payment"
      ? submitting ||
        payState === "awaiting_auth" ||
        payState === "verifying" ||
        payState === "success" ||
        !paymentsAvailable ||
        !canContinue
      : !canContinue;

  const primaryLabel =
    step === "payment"
      ? placeLabel
      : step === "contact"
        ? "Continue to pay"
        : "Continue";

  const onPrimary = () => {
    if (step === "payment") {
      void handleSubmit(onSubmit)();
      return;
    }
    void goNext();
  };

  const dock =
    displayCartItems.length > 0 && !authLoading && !cartLoading ? (
      <div
        className={cn(
          "flex gap-3 sm:gap-4",
          step === "payment"
            ? "flex-col sm:flex-row sm:items-center"
            : "items-center",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={stepIndex <= 0 ? goToCart : goBack}
            className="min-h-11 shrink-0 px-1 text-[13px] text-black/45 hover:text-black"
          >
            {stepIndex <= 0 ? "Bag" : "Back"}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-black/35">
              {step === "payment" && payMeta ? payMeta.shortLabel : "Total"}
            </p>
            <p className="truncate text-[18px] font-semibold tabular-nums tracking-tight sm:text-[19px]">
              {formatPrice(grandTotal)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className={cn(
            "inline-flex min-h-12 shrink-0 items-center justify-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white hover:opacity-80 disabled:opacity-40 sm:px-7",
            step === "payment" && "w-full sm:w-auto",
          )}
        >
          {primaryLabel}
        </button>
      </div>
    ) : (
      <div className="flex justify-end">
        <Link
          href="/cart"
          className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.14em] text-white"
        >
          Back to bag
        </Link>
      </div>
    );

  const summaryBlock =
    displayCartItems.length > 0 ? (
      <OrderSummaryBlock
        items={displayCartItems}
        open={summaryOpen}
        onToggle={() => setSummaryOpen((v) => !v)}
        subtotal={subtotal}
        deliveryMinor={deliveryMinor}
        grandTotal={grandTotal}
        unitPrice={unitPrice}
        forceOpen
        fulfilment={fulfilment}
      />
    ) : undefined;

  const mobileSummary =
    displayCartItems.length > 0 ? (
      <OrderSummaryBlock
        items={displayCartItems}
        open={summaryOpen}
        onToggle={() => setSummaryOpen((v) => !v)}
        subtotal={subtotal}
        deliveryMinor={deliveryMinor}
        grandTotal={grandTotal}
        unitPrice={unitPrice}
        fulfilment={fulfilment}
        hideTitle
      />
    ) : undefined;

  return (
    <CheckoutShell
      summary={summaryBlock}
      mobileSummary={mobileSummary}
      dock={dock}
      steps={shellSteps}
      stepIndex={stepIndex}
      flowLabel={flowLabel}
    >
      <div>
        {cancelled ? (
          <div className="mb-6 border border-amber-900/15 bg-amber-50/80 px-4 py-3 text-[13px] text-amber-950">
            Payment was cancelled. Choose a method and try again when ready.
          </div>
        ) : null}
        {configError ? (
          <div className="mb-6 border border-red-900/15 bg-red-50/70 px-4 py-3 text-[13px] text-red-800">
            {configError}
          </div>
        ) : null}
        {payMessage &&
        (payState === "starting" ||
          payState === "awaiting_auth" ||
          payState === "verifying") ? (
          <div className="mb-6 border border-black/10 bg-white px-4 py-4 text-[14px] leading-relaxed text-black/60 sm:px-5">
            {payMessage}
          </div>
        ) : null}

        <div>
          {authLoading || cartLoading ? (
            <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
              Loading
            </p>
          ) : displayCartItems.length === 0 ? (
            <div>
              {heading("Your bag is empty", "Add something before checkout.")}
              <button
                type="button"
                onClick={goToCart}
                className="mt-10 text-[14px] underline underline-offset-[5px] decoration-black/20"
              >
                Back to bag
              </button>
            </div>
          ) : (
            <form id="kc-checkout-wizard" onSubmit={handleSubmit(onSubmit)}>
              {step === "collect" ? (
                <PickupCollectStep
                  vendors={checkoutVendors}
                  loading={vendorsLoading}
                  collectMode={collectMode}
                  onCollectModeChange={setCollectMode}
                  hubVendorId={hubVendorId}
                  onHubVendorChange={setHubVendorId}
                  hybridQuote={hybridQuote}
                  classicQuote={classicQuote}
                />
              ) : null}

              {step === "contact" ? (
                <div>
                  {heading(
                    "Your details",
                    "We’ll use these for pickup alerts. You’ll get a receipt after pay.",
                  )}
                  <div className="mt-10 space-y-6">
                    <label className="block space-y-2">
                      <span className="text-[12px] text-black/40">Name</span>
                      <input
                        {...register("customerName")}
                        className={fieldClass}
                        autoComplete="name"
                        autoFocus
                      />
                      {errors.customerName ? (
                        <span className="block text-[12px] text-red-600">
                          {errors.customerName.message}
                        </span>
                      ) : null}
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[12px] text-black/40">Email</span>
                      <input
                        {...register("customerEmail")}
                        className={fieldClass}
                        autoComplete="email"
                        type="email"
                      />
                      {errors.customerEmail ? (
                        <span className="block text-[12px] text-red-600">
                          {errors.customerEmail.message}
                        </span>
                      ) : null}
                    </label>
                    <PhoneField
                      value={customerPhone}
                      onChange={(digits) =>
                        setValue("customerPhone", digits, {
                          shouldValidate: true,
                        })
                      }
                      error={errors.customerPhone?.message}
                    />
                  </div>
                </div>
              ) : null}

              {step === "payment" ? (
                <PaymentStep
                  payMethod={payMethod}
                  onSelect={setPayMethod}
                  mpesaPhone={mpesaPhone}
                  onMpesaPhoneChange={setMpesaPhone}
                  customerPhone={customerPhone}
                  stripeReady={payConfig.stripeReady}
                  paystackReady={payConfig.paystackReady}
                  paymentsAvailable={paymentsAvailable}
                  configError={configError}
                  grandTotal={grandTotal}
                  itemCount={displayCartItems.reduce(
                    (n, i) => n + i.quantity,
                    0,
                  )}
                />
              ) : null}

              {stepError ? (
                <p className="mt-8 text-[14px] text-red-700">{stepError}</p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </CheckoutShell>
  );
}
