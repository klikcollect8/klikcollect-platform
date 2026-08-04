"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/types";
import { CloseIcon } from "@/components/NavIcons";
import { useToast } from "@/components/ToastProvider";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useCart } from "@/lib/hooks/useCart";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { formatPrice } from "@/lib/currency";
import { resolveProductImage } from "@/lib/product-image";
import { openPaystackAccessCode } from "@/lib/paystack/inline";
import {
  isValidKenyaMpesaPhone,
  normalizeKenyaPhone,
} from "@/lib/paystack/phone";
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
import PaymentMethodSheet from "@/components/checkout/PaymentMethodSheet";
import ThemeSelect from "@/components/ui/ThemeSelect";
import {
  DELIVERY_FLOW,
  PICKUP_FLOW,
  fulfilmentLabel,
  resolveAreaLabel,
  type CheckoutStepId,
  type FulfilmentMethod,
} from "@/components/checkout/fulfilment";
import {
  defaultPayMethod,
  getPayMethodMeta,
  isMpesaPayMethod,
  PAY_METHODS,
  type PayMethod,
} from "@/components/checkout/payment-methods";
import type { CheckoutVendor, CollectMode } from "@/lib/checkout/types";
import {
  quoteClassicPickup,
  quoteHomeDelivery,
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

type Props = {
  onClose: () => void;
};

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

function cartVendorIds(items: CartItem[]): string[] {
  return [
    ...new Set(
      items
        .map((i) => i.vendorId)
        .filter((id): id is string => !!id && id !== "platform"),
    ),
  ];
}

/**
 * Stepped checkout popup.
 * Delivery: location (address + distance fee + instructions + same-day time) → contact → pay → review
 * Pickup: collect (vendor / hybrid) → same-day time → contact → pay → review
 */
export default function CheckoutPopup({ onClose }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const { isSignedIn, loading: authLoading, user } = useUserAuth();
  const { cartItems, loading: cartLoading, clearCart } = useCart();
  const mounted = useIsClient();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<CheckoutStepId>("method");
  const [stepError, setStepError] = useState<string | null>(null);

  const [fulfilment, setFulfilment] = useState<FulfilmentMethod | null>(null);

  // Delivery location
  const [deliveryArea, setDeliveryArea] = useState("westlands");
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
  const [paySheetOpen, setPaySheetOpen] = useState(false);
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
    (street.trim().length >= 4 ||
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

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !paySheetOpen) handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, paySheetOpen]);

  useEffect(() => {
    if (authLoading || cartLoading) return;
    if (!isSignedIn) {
      handleClose();
      router.replace("/sign-in?redirect=/checkout");
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
    handleClose,
  ]);

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

  // Distance / hybrid pricing — delivery never free
  useEffect(() => {
    if (!fulfilment) {
      setDeliveryMinor(0);
      setActiveQuote(null);
      return;
    }

    const shopCoords = checkoutVendors
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => ({ lat: v.lat as number, lng: v.lng as number }));

    if (fulfilment === "delivery") {
      if (deliveryLat != null && deliveryLng != null) {
        const q = quoteHomeDelivery(
          { lat: deliveryLat, lng: deliveryLng },
          shopCoords.length
            ? shopCoords
            : [{ lat: deliveryLat, lng: deliveryLng }],
        );
        setActiveQuote(q);
        setDeliveryMinor(q.deliveryMinor);
      } else {
        const q = quoteHomeDelivery(
          { lat: -1.2921, lng: 36.8219 },
          shopCoords,
        );
        setActiveQuote(q);
        setDeliveryMinor(q.deliveryMinor);
      }
      return;
    }

    // pickup
    if (collectMode === "hybrid" && checkoutVendors.length > 1) {
      const idx = Math.max(
        0,
        checkoutVendors.findIndex((v) => v.vendorId === hubVendorId),
      );
      const q = quoteHybridConsolidate(shopCoords, idx);
      setActiveQuote(q);
      setDeliveryMinor(q.deliveryMinor);
    } else {
      const q = quoteClassicPickup();
      setActiveQuote(q);
      setDeliveryMinor(0);
    }
  }, [
    fulfilment,
    deliveryLat,
    deliveryLng,
    checkoutVendors,
    collectMode,
    hubVendorId,
  ]);

  useEffect(() => {
    fetch("/api/payments/config")
      .then((r) => r.json())
      .then((j) => {
        // API shape: { data: { stripe: { ready }, paystack: { ready }, methods } }
        const stripeReady = !!(
          j.data?.stripe?.ready ??
          j.data?.stripeReady ??
          j.data?.methods?.card === "stripe"
        );
        const paystackReady = !!(
          j.data?.paystack?.ready ??
          j.data?.paystackReady ??
          j.data?.methods?.mpesa === "paystack"
        );
        setPayConfig({ stripeReady, paystackReady });
        setPayMethod((prev) => prev ?? defaultPayMethod(stripeReady, paystackReady));
      })
      .catch(() => {});
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
        handleClose();
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
        provider === "stripe" ? "Opening card checkout…" : "Starting M-Pesa…",
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
      if (accessCode) {
        setPayState("awaiting_auth");
        setPayMessage("Complete payment in the popup…");
        try {
          await openPaystackAccessCode(accessCode);
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
    <>
      <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
        {title}
      </h2>
      <p className="mt-3 text-[14px] text-black/45">{sub}</p>
    </>
  );

  const flowLabel =
    fulfilment === "delivery"
      ? "Delivery"
      : fulfilment === "pickup"
        ? "Click & collect"
        : "Checkout";

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

  if (!mounted || typeof document === "undefined") return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[720px] flex-col px-5 sm:px-8">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            {flowLabel}
            {itemCount > 0 ? (
              <span className="ml-2 normal-case tracking-normal text-black/30">
                · {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
            aria-label="Close"
          >
            <span className="hidden sm:inline">Esc</span>
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="mt-5 shrink-0">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-black/35">
            <span>
              Step {stepIndex + 1} of {flow.length}
            </span>
            <span>
              {Math.round(((stepIndex + 1) / Math.max(flow.length, 1)) * 100)}%
            </span>
          </div>
          <div className="mt-2 h-px bg-black/10">
            <div
              className="h-px bg-black transition-all duration-500 ease-out"
              style={{
                width: `${((stepIndex + 1) / Math.max(flow.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        <div
          className={`scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-6 pt-10 transition-all duration-500 ease-out sm:pt-14 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {authLoading || cartLoading ? (
            <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
              Loading
            </p>
          ) : displayCartItems.length === 0 ? (
            <div>
              {heading("Your bag is empty", "Add something before checkout.")}
              <button
                type="button"
                onClick={handleClose}
                className="mt-10 text-[14px] underline underline-offset-[5px] decoration-black/20"
              >
                Close
              </button>
            </div>
          ) : (
            <form id="kc-checkout-wizard" onSubmit={handleSubmit(onSubmit)}>
              {step === "method" ? (
                <div>
                  {heading(
                    "How do you want it?",
                    "Same-day only — delivery to you, or collect from the shop.",
                  )}
                  <div className="mt-8 space-y-3">
                    {(
                      [
                        {
                          id: "pickup" as const,
                          title: "Click & collect",
                          sub:
                            checkoutVendors.length > 1
                              ? "Visit each shop, or consolidate to one point"
                              : "Collect from the vendor — no delivery fee",
                        },
                        {
                          id: "delivery" as const,
                          title: "Delivery",
                          sub: "To your live location · priced by distance · never free",
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
                            "flex w-full flex-col items-start gap-1 border-b border-black/[0.06] py-5 text-left transition-opacity hover:opacity-70",
                            selected ? "text-black" : "text-black/45",
                          )}
                        >
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="text-[17px] font-medium sm:text-[18px]">
                              {opt.title}
                            </span>
                            <span className="text-[11px] uppercase tracking-[0.14em] text-black/30">
                              {selected ? "Selected" : "Select"}
                            </span>
                          </span>
                          <span className="text-[13px] text-black/40">
                            {opt.sub}
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
                <div>
                  {heading("How you’ll pay", "Card or M-Pesa.")}
                  {!paymentsAvailable ? (
                    <p className="mt-10 text-[14px] text-black/40">
                      Payments are unavailable right now.
                    </p>
                  ) : (
                    <div className="mt-10 space-y-6">
                      <label className="block space-y-2">
                        <span className="text-[12px] text-black/40">Method</span>
                        <ThemeSelect
                          value={payMethod ?? ""}
                          onValueChange={(v) => setPayMethod(v as PayMethod)}
                          options={PAY_METHODS.filter((m) =>
                            m.id === "stripe_card"
                              ? payConfig.stripeReady
                              : payConfig.paystackReady,
                          ).map((m) => ({
                            value: m.id,
                            label: m.label,
                          }))}
                          placeholder="Choose payment"
                          fullWidth
                        />
                      </label>
                      {isMpesaPayMethod(payMethod) ? (
                        <PhoneField
                          value={mpesaPhone || customerPhone}
                          onChange={setMpesaPhone}
                          id="mpesaPhone"
                        />
                      ) : payMethod === "stripe_card" ? (
                        <p className="text-[13px] text-black/35">
                          Card details are entered on the secure Stripe page.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPaySheetOpen(true)}
                        className="text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/15"
                      >
                        Open payment chooser
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {step === "review" ? (
                <div className="space-y-10">
                  {heading(
                    "Review & place order",
                    fulfilment === "delivery"
                      ? "Confirm delivery details before paying."
                      : "Confirm collect details before paying.",
                  )}
                  <dl className="space-y-5 text-[15px]">
                    <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
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
                      <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
                        <dt className="text-black/40">Collect</dt>
                        <dd className="max-w-[60%] text-right font-medium">
                          {collectHubLabel}
                        </dd>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
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
                          <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
                            <dt className="text-black/40">Trip</dt>
                            <dd className="max-w-[60%] text-right text-[13px] text-black/55">
                              {activeQuote.breakdown} · ~{activeQuote.etaMinutes}{" "}
                              min
                            </dd>
                          </div>
                        ) : null}
                        {deliveryNote.trim() ? (
                          <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
                            <dt className="text-black/40">Instructions</dt>
                            <dd className="max-w-[60%] text-right text-[13px] text-black/55">
                              {deliveryNote.trim()}
                            </dd>
                          </div>
                        ) : null}
                      </>
                    )}
                    <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
                      <dt className="text-black/40">When</dt>
                      <dd className="font-medium">{whenSummary}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
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
                    <div className="flex justify-between gap-4 border-b border-black/8 pb-4">
                      <dt className="text-black/40">Payment</dt>
                      <dd className="text-right font-medium">
                        {payMeta?.shortLabel ?? "—"}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
                      Bag
                    </p>
                    <ul className="mt-5 space-y-4">
                      {displayCartItems.map((item) => (
                        <li
                          key={item.offerId || item.product.id}
                          className="flex gap-4"
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
                            <p className="truncate text-[14px] font-medium">
                              {item.product.name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-black/40">
                              Qty {item.quantity}
                              {item.vendorName ? ` · ${item.vendorName}` : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-[14px] tabular-nums">
                            {formatPrice(unitPrice(item) * item.quantity)}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 space-y-2.5 border-t border-black/10 pt-5 text-[14px]">
                      <div className="flex justify-between gap-4">
                        <span className="text-black/40">Subtotal</span>
                        <span className="tabular-nums">
                          {formatPrice(subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-black/40">
                          {fulfilment === "delivery"
                            ? "Delivery"
                            : collectMode === "hybrid" &&
                                checkoutVendors.length > 1
                              ? "Consolidate"
                              : "Pickup"}
                        </span>
                        <span className="tabular-nums text-black/60">
                          {deliveryMinor > 0
                            ? formatPrice(deliveryMajor)
                            : fulfilment === "delivery"
                              ? formatPrice(0)
                              : "No fee"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 pt-1 text-[17px] font-medium">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {formatPrice(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
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

        {displayCartItems.length > 0 && !authLoading && !cartLoading ? (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-black/10 bg-[#f7f7f5]/95 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
            {step === "method" ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-11 px-2 text-[13px] text-black/45 hover:text-black"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={!canContinue}
                  className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80 disabled:opacity-30"
                >
                  Continue
                </button>
              </>
            ) : null}

            {step !== "method" && step !== "review" ? (
              <>
                <button
                  type="button"
                  onClick={goBack}
                  className="min-h-11 px-2 text-[13px] text-black/45 hover:text-black"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={!canContinue}
                  className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80 disabled:opacity-30"
                >
                  {step === "location" ? "Looks good" : "Continue"}
                </button>
              </>
            ) : null}

            {step === "review" ? (
              <>
                <button
                  type="button"
                  onClick={goBack}
                  className="min-h-11 px-2 text-[13px] text-black/45 hover:text-black"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="kc-checkout-wizard"
                  disabled={
                    submitting ||
                    payState === "awaiting_auth" ||
                    payState === "verifying" ||
                    payState === "success" ||
                    !paymentsAvailable
                  }
                  className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white hover:opacity-80 disabled:opacity-45"
                >
                  {placeLabel}
                </button>
              </>
            ) : null}
          </footer>
        ) : null}
      </div>

      <PaymentMethodSheet
        open={paySheetOpen}
        onClose={() => setPaySheetOpen(false)}
        payMethod={payMethod}
        onSelect={setPayMethod}
        mpesaPhone={mpesaPhone}
        onMpesaPhoneChange={setMpesaPhone}
        cardAvailable={payConfig.stripeReady}
        mpesaAvailable={payConfig.paystackReady}
      />
    </div>
  );

  return createPortal(content, document.body);
}
