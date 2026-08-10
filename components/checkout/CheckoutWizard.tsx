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
import DeliveryLocationStep, {
  type DeliveryLocationValue,
} from "@/components/checkout/DeliveryLocationStep";
import PickupCollectStep from "@/components/checkout/PickupCollectStep";
import PhoneField, {
  toKenyaPhoneE164,
} from "@/components/checkout/PhoneField";
import SameDayTiming, {
  type TimingMode,
} from "@/components/checkout/SameDayTiming";
import {
  DELIVERY_FLOW,
  PICKUP_FLOW,
  fulfilmentLabel,
  resolveAreaLabel,
  type CheckoutStepId,
  type FulfilmentMethod,
} from "@/components/checkout/fulfilment";
import { cartVendorIds } from "@/lib/checkout/cart-vendors";
import { getDeliveryZone } from "@/lib/checkout/delivery-zones";
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
 * Full-page stepped checkout.
 * Delivery: location → contact → pay → review
 * Pickup: collect → when → contact → pay → review
 */
export default function CheckoutWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { isSignedIn, loading: authLoading, user } = useUserAuth();
  const { showSignInModal } = useSignInModal();
  const { cartItems, loading: cartLoading, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStepId>("method");
  const [stepError, setStepError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const cancelled = searchParams.get("cancelled") === "1";

  const [fulfilment, setFulfilment] = useState<FulfilmentMethod | null>(null);

  // Delivery location
  const [deliveryArea, setDeliveryArea] = useState("");
  const [areaOther, setAreaOther] = useState("");
  const [building, setBuilding] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliveryLabel, setDeliveryLabel] = useState("");
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [gateCode, setGateCode] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");

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

  const deliveryLocation: DeliveryLocationValue = {
    deliveryArea,
    areaOther,
    building,
    street,
    landmark,
    lat: deliveryLat,
    lng: deliveryLng,
    label: deliveryLabel,
    gateCode,
    deliveryNote,
  };

  const setDeliveryLocation = (next: DeliveryLocationValue) => {
    setDeliveryArea(next.deliveryArea);
    setAreaOther(next.areaOther);
    setBuilding(next.building);
    setStreet(next.street);
    setLandmark(next.landmark);
    setDeliveryLat(next.lat);
    setDeliveryLng(next.lng);
    setDeliveryLabel(next.label);
    setGateCode(next.gateCode);
    setDeliveryNote(next.deliveryNote);
  };

  const flow = useMemo((): CheckoutStepId[] => {
    if (fulfilment === "delivery") return [...DELIVERY_FLOW];
    if (fulfilment === "pickup") return [...PICKUP_FLOW];
    return ["method"];
  }, [fulfilment]);

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

  // Prefill method + zone from bag when customer already chose on PDP
  useEffect(() => {
    const withDelivery = displayCartItems.find(
      (i) => i.fulfilment === "delivery" && i.deliveryZoneId,
    );
    if (withDelivery?.deliveryZoneId) {
      setFulfilment((prev) => prev ?? "delivery");
      setDeliveryArea(withDelivery.deliveryZoneId);
      return;
    }
    const pickupOnly =
      displayCartItems.length > 0 &&
      displayCartItems.every((i) => i.fulfilment === "pickup");
    if (pickupOnly) {
      setFulfilment((prev) => prev ?? "pickup");
    }
  }, [displayCartItems]);

  const unitPrice = (item: CartItem) =>
    item.offerPrice ?? item.product.price ?? 0;
  const subtotal = displayCartItems.reduce(
    (sum, item) => sum + unitPrice(item) * item.quantity,
    0,
  );
  const deliveryMajor = deliveryMinor / 100;
  const grandTotal = subtotal + deliveryMajor;
  const itemCount = displayCartItems.reduce((n, i) => n + i.quantity, 0);

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
      case "when":
        return !!pickupDate && !!pickupTime && !dayWindow.isClosed;
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

  // Prefill fulfilment from bag when every line agrees
  useEffect(() => {
    if (fulfilment) return;
    const modes = displayCartItems
      .map((i) => i.fulfilment)
      .filter((m): m is FulfilmentMethod => m === "pickup" || m === "delivery");
    if (!modes.length) return;
    if (modes.every((m) => m === modes[0])) {
      setFulfilment(modes[0]!);
    }
  }, [displayCartItems, fulfilment]);

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

  // Road-distance pricing via /api/checkout/delivery-quote (zone fallback)
  useEffect(() => {
    if (!fulfilment) {
      setDeliveryMinor(0);
      setActiveQuote(null);
      return;
    }

    const shopCoords = checkoutVendors
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => ({ lat: v.lat as number, lng: v.lng as number }));

    const hubIndex = Math.max(
      0,
      checkoutVendors.findIndex((v) => v.vendorId === hubVendorId),
    );

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/checkout/delivery-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            fulfilment,
            collectMode,
            hubIndex,
            zoneId:
              fulfilment === "delivery"
                ? deliveryArea === "other"
                  ? "flat_rate"
                  : getDeliveryZone(deliveryArea)?.id || null
                : null,
            areaLabel:
              fulfilment === "delivery"
                ? resolveAreaLabel(deliveryArea, areaOther) ||
                  deliveryLabel ||
                  null
                : null,
            drop:
              fulfilment === "delivery" &&
              deliveryLat != null &&
              deliveryLng != null
                ? { lat: deliveryLat, lng: deliveryLng }
                : null,
            shops: shopCoords,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const q = (json?.data || {}) as DeliveryQuote;
        if (typeof q.deliveryMinor === "number") {
          setActiveQuote(q);
          setDeliveryMinor(q.deliveryMinor);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Soft fallback: keep previous quote
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    fulfilment,
    deliveryArea,
    deliveryLat,
    deliveryLng,
    deliveryArea,
    areaOther,
    deliveryLabel,
    checkoutVendors,
    collectMode,
    hubVendorId,
  ]);

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
    if (!flow.includes(step)) setStep(flow[0] || "method");
  }, [flow, step]);

  // Ensure same-day date
  useEffect(() => {
    if (pickupDate !== today) setValue("pickupDate", today);
  }, [pickupDate, today, setValue]);

  const selectFulfilment = (m: FulfilmentMethod) => {
    setFulfilment(m);
    if (m === "pickup" && checkoutVendors.length <= 1) {
      setCollectMode("classic");
    }
  };

  const goNext = async () => {
    setStepError(null);
    if (step === "method" && !fulfilment) {
      setStepError("Choose delivery or click & collect");
      return;
    }
    if (step === "location" && !canContinue) {
      setStepError("Confirm location and a same-day delivery time");
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
    if (step === "when") {
      if (!canContinue) {
        setStepError("Choose a collection time for today");
        return;
      }
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
      setStep("method");
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
    step === "review"
      ? submitting ||
        payState === "awaiting_auth" ||
        payState === "verifying" ||
        payState === "success" ||
        !paymentsAvailable
      : !canContinue;

  const primaryLabel =
    step === "review"
      ? placeLabel
      : step === "location"
        ? "Confirm address"
        : step === "payment"
          ? "Review order"
          : "Continue";

  const onPrimary = () => {
    if (step === "review") return;
    void goNext();
  };

  const dock =
    displayCartItems.length > 0 && !authLoading && !cartLoading ? (
      <div className="flex items-center gap-3 sm:gap-4">
        {step === "method" ? (
          <button
            type="button"
            onClick={goToCart}
            className="min-h-11 shrink-0 px-1 text-[13px] text-black/45 hover:text-black"
          >
            Bag
          </button>
        ) : (
          <button
            type="button"
            onClick={goBack}
            className="min-h-11 shrink-0 px-1 text-[13px] text-black/45 hover:text-black"
          >
            Back
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-black/35">
            Total
          </p>
          <p className="truncate text-[17px] font-semibold tabular-nums tracking-tight sm:text-[18px]">
            {formatPrice(grandTotal)}
          </p>
        </div>
        {step === "review" ? (
          <button
            type="submit"
            form="kc-checkout-wizard"
            disabled={primaryDisabled}
            className="inline-flex min-h-12 shrink-0 items-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white hover:opacity-80 disabled:opacity-40 sm:px-7"
          >
            {primaryLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="inline-flex min-h-12 shrink-0 items-center bg-black px-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white hover:opacity-80 disabled:opacity-40 sm:px-7"
          >
            {primaryLabel}
          </button>
        )}
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
          <div className="mb-6 border border-black/10 bg-white/60 px-4 py-3 text-[13px] text-black/55">
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
              {step === "method" ? (
                <div>
                  {heading(
                    "How do you want it?",
                    "Same-day only in Nairobi — pick up at the shop, or get it delivered.",
                  )}
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        {
                          id: "pickup" as const,
                          label: "Click & collect",
                          detail:
                            checkoutVendors.length > 1
                              ? "Collect from each shop, or consolidate to one hub."
                              : "Collect from the vendor — usually no delivery fee.",
                        },
                        {
                          id: "delivery" as const,
                          label: "Delivery",
                          detail: activeQuote
                            ? `${formatPrice(activeQuote.deliveryMinor / 100)} · ~${activeQuote.etaMinutes} min${
                                activeQuote.distanceKm > 0
                                  ? ` · ${activeQuote.distanceKm.toFixed(1)} km`
                                  : ""
                              }`
                            : "Priced by road distance from your live location.",
                        },
                      ] as const
                    ).map((opt) => {
                      const selected = fulfilment === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => selectFulfilment(opt.id)}
                          className={cn(
                            "flex flex-col items-start border px-4 py-4 text-left transition-colors",
                            selected
                              ? "border-black bg-white"
                              : "border-black/10 bg-white/40 hover:border-black/25",
                          )}
                        >
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="text-[15px] font-semibold tracking-tight">
                              {opt.label}
                            </span>
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                selected
                                  ? "border-black bg-black"
                                  : "border-black/25",
                              )}
                              aria-hidden
                            >
                              {selected ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              ) : null}
                            </span>
                          </span>
                          <span className="mt-2 text-[13px] leading-relaxed text-black/45">
                            {opt.detail}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === "location" ? (
                <DeliveryLocationStep
                  value={deliveryLocation}
                  onChange={setDeliveryLocation}
                  vendors={checkoutVendors}
                  quote={activeQuote}
                  dayWindow={dayWindow}
                  timingMode={timingMode}
                  pickupDate={pickupDate}
                  pickupTime={pickupTime}
                  onTimingModeChange={setTimingMode}
                  onTimingChange={({ date, time, mode }) => {
                    setTimingMode(mode);
                    setValue("pickupDate", date);
                    setValue("pickupTime", time, { shouldValidate: true });
                  }}
                />
              ) : null}

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

              {step === "when" ? (
                <div>
                  {heading(
                    "When will you collect?",
                    "Same day only — during the shop’s working hours.",
                  )}
                  <SameDayTiming
                    window={dayWindow}
                    mode={timingMode}
                    time={pickupTime}
                    etaMinutes={activeQuote?.etaMinutes || 30}
                    onModeChange={setTimingMode}
                    onChange={({ date, time, mode }) => {
                      setTimingMode(mode);
                      setValue("pickupDate", date);
                      setValue("pickupTime", time, { shouldValidate: true });
                    }}
                    fulfilment="pickup"
                  />
                </div>
              ) : null}

              {step === "contact" ? (
                <div>
                  {heading(
                    "Your details",
                    "We’ll use these for order updates and delivery calls.",
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

              {step === "review" ? (
                <div className="space-y-8">
                  {heading(
                    "Review & place order",
                    fulfilment === "delivery"
                      ? "Confirm delivery details before paying."
                      : "Confirm collect details before paying.",
                  )}
                  <section className="border border-black/[0.08] bg-white/60 px-4 py-1 sm:px-5">
                    <dl className="divide-y divide-black/[0.06] text-[15px]">
                      <div className="flex justify-between gap-4 py-4">
                        <dt className="text-black/40">Method</dt>
                        <dd className="text-right font-medium">
                          {fulfilmentLabel(fulfilment)}
                          {fulfilment === "pickup" &&
                          collectMode === "hybrid" &&
                          checkoutVendors.length > 1
                            ? " · Hybrid"
                            : ""}
                        </dd>
                      </div>
                      {fulfilment === "pickup" ? (
                        <div className="flex justify-between gap-4 py-4">
                          <dt className="text-black/40">Collect</dt>
                          <dd className="max-w-[60%] text-right font-medium">
                            {collectHubLabel}
                          </dd>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between gap-4 py-4">
                            <dt className="text-black/40">Deliver to</dt>
                            <dd className="max-w-[60%] text-right font-medium">
                              <span className="block">{areaLabel}</span>
                              {composedAddress ? (
                                <span className="mt-1 block text-[13px] font-normal text-black/45">
                                  {composedAddress}
                                </span>
                              ) : null}
                              {gateCode.trim() ? (
                                <span className="mt-1 block text-[13px] font-normal text-black/45">
                                  Gate {gateCode.trim()}
                                </span>
                              ) : null}
                            </dd>
                          </div>
                          {activeQuote ? (
                            <div className="flex justify-between gap-4 py-4">
                              <dt className="text-black/40">Trip</dt>
                              <dd className="max-w-[60%] text-right text-[13px] text-black/55">
                                {activeQuote.breakdown} · ~
                                {activeQuote.etaMinutes} min
                              </dd>
                            </div>
                          ) : null}
                          {deliveryNote.trim() ? (
                            <div className="flex justify-between gap-4 py-4">
                              <dt className="text-black/40">Instructions</dt>
                              <dd className="max-w-[60%] text-right text-[13px] text-black/55">
                                {deliveryNote.trim()}
                              </dd>
                            </div>
                          ) : null}
                        </>
                      )}
                      <div className="flex justify-between gap-4 py-4">
                        <dt className="text-black/40">When</dt>
                        <dd className="text-right font-medium">{whenSummary}</dd>
                      </div>
                      <div className="flex justify-between gap-4 py-4">
                        <dt className="text-black/40">Contact</dt>
                        <dd className="max-w-[60%] text-right font-medium">
                          <span className="block">{customerName}</span>
                          <span className="mt-0.5 block text-[13px] font-normal text-black/45">
                            {customerEmail}
                          </span>
                          <span className="mt-0.5 block text-[13px] font-normal text-black/45">
                            +254 {customerPhone.replace(/\D/g, "")}
                          </span>
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 py-4">
                        <dt className="text-black/40">Payment</dt>
                        <dd className="text-right font-medium">
                          {payMeta?.shortLabel ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {/* Bag lines live in the sidebar / mobile accordion — keep a compact total here */}
                  <section className="flex items-end justify-between gap-4 border-t border-black/10 pt-6">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
                        Amount due
                      </p>
                      <p className="mt-1 text-[13px] text-black/45">
                        {displayCartItems.reduce((n, i) => n + i.quantity, 0)}{" "}
                        {displayCartItems.reduce((n, i) => n + i.quantity, 0) ===
                        1
                          ? "item"
                          : "items"}
                        {deliveryMinor > 0
                          ? ` · ${fulfilment === "delivery" ? "incl. delivery" : "incl. consolidate"}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-[22px] font-semibold tabular-nums tracking-tight">
                      {formatPrice(grandTotal)}
                    </p>
                  </section>
                  {payMessage ? (
                    <p className="text-[13px] text-black/45">{payMessage}</p>
                  ) : null}
                </div>
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
