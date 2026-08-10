"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FulfilmentMethod,
  Product,
  ProductOffer,
  ProductVariation,
} from "@/types";
import { Minus, Plus } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedProducts from "@/components/RelatedProducts";
import ImageGallery from "@/components/ImageGallery";
import WishlistButton from "@/components/WishlistButton";
import ProductReviews from "@/components/ProductReviews";
import ProductQuestions from "@/components/ProductQuestions";
import SizeGuide from "@/components/SizeGuide";
import { CloseIcon, SearchIcon } from "@/components/NavIcons";
import { useToast } from "@/components/ToastProvider";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useCart } from "@/lib/hooks/useCart";
import { useUserLocation } from "@/components/providers/LocationProvider";
import { formatPrice } from "@/lib/currency";
import { resolveVendorSlug } from "@/lib/vendor-slug";
import {
  rankOffers,
  sortRankedOffers,
  TOP_OFFER_COUNT,
  type OfferSortMode,
  type RankedOffer,
} from "@/lib/offers/rank-offers";
import { cn } from "@/lib/utils";
import MapPreview from "@/components/map/MapPreview";

type TabType = "details" | "location" | "reviews" | "questions";

function ProductPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { loading: authLoading } = useUserAuth();
  const { addToCart: addToCartHook } = useCart();
  const { coords, status: locationStatus, track: trackLocation } =
    useUserLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [offers, setOffers] = useState<ProductOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [selectedVariations, setSelectedVariations] = useState<
    Record<string, string>
  >({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseVisible, setBrowseVisible] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseSort, setBrowseSort] = useState<OfferSortMode>("best");
  const [sheetMounted, setSheetMounted] = useState(false);
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod | null>(null);
  const [deliveryQuoteMajor, setDeliveryQuoteMajor] = useState<number | null>(
    null,
  );
  const [deliveryQuoteLabel, setDeliveryQuoteLabel] = useState<string | null>(
    null,
  );
  const [deliveryQuoting, setDeliveryQuoting] = useState(false);
  const prefillOffer = searchParams.get("offer");

  useEffect(() => {
    setSheetMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedOfferId && activeTab !== "details") {
      setActiveTab("details");
    }
  }, [selectedOfferId, activeTab]);

  useEffect(() => {
    if (!browseOpen) {
      setBrowseVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setBrowseVisible(true));
    });
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBrowseOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [browseOpen]);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    fetch(`/api/products/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.error || !data?.id) {
          setProduct(null);
          setOffers([]);
          return;
        }
        setProduct(data);
        const list: ProductOffer[] = Array.isArray(data.offers)
          ? data.offers
          : [];
        setOffers(list);
        // Only prefill when ?offer= is present — otherwise require explicit pick
        if (prefillOffer && list.some((o) => o.id === prefillOffer)) {
          setSelectedOfferId(prefillOffer);
        } else {
          setSelectedOfferId(null);
        }
        if (data.variations && Array.isArray(data.variations)) {
          const initial: Record<string, string> = {};
          data.variations.forEach((v: ProductVariation) => {
            initial[v.name] = v.selected || v.options[0];
          });
          setSelectedVariations(initial);
        }
      })
      .catch(() => {
        setProduct(null);
        setOffers([]);
      })
      .finally(() => setLoading(false));
  }, [params.id, prefillOffer]);

  const userPoint = useMemo(
    () =>
      coords
        ? { lat: coords.lat, lng: coords.lng }
        : null,
    [coords],
  );

  const selectedVariantId = useMemo(() => {
    const variants = product?.catalogueVariants || [];
    if (!variants.length) return null;
    if (variants.length === 1 && !(product?.variations?.length)) {
      return variants[0].id;
    }
    const axes = product?.variations || [];
    if (!axes.length) return variants[0]?.id ?? null;
    if (!axes.every((v) => selectedVariations[v.name])) return null;
    if (axes.length === 1 && axes[0].name === "Option") {
      const title = selectedVariations.Option;
      return variants.find((v) => v.title === title)?.id ?? null;
    }
    return (
      variants.find((v) =>
        Object.entries(selectedVariations).every(
          ([key, val]) => (v.options || {})[key] === val,
        ),
      )?.id ?? null
    );
  }, [product, selectedVariations]);

  const rankedOffers = useMemo(() => {
    const multiVariant = (product?.catalogueVariants?.length || 0) > 1;
    const filtered =
      multiVariant && selectedVariantId
        ? offers.filter(
            (o) =>
              o.variantPublicId === selectedVariantId ||
              (!o.variantPublicId &&
                product?.catalogueVariants?.[0]?.id === selectedVariantId),
          )
        : multiVariant && !selectedVariantId
          ? []
          : offers;
    return rankOffers(filtered, userPoint);
  }, [offers, userPoint, product, selectedVariantId]);

  useEffect(() => {
    if (!selectedOfferId) return;
    if (!rankedOffers.some((o) => o.id === selectedOfferId)) {
      setSelectedOfferId(rankedOffers[0]?.id ?? null);
    }
  }, [rankedOffers, selectedOfferId]);

  const topOffers = useMemo(
    () => rankedOffers.slice(0, TOP_OFFER_COUNT),
    [rankedOffers],
  );

  const selectOffer = (id: string) => {
    setSelectedOfferId((prev) => (prev === id ? null : id));
    setBrowseOpen(false);
  };

  const clearOffer = () => {
    setSelectedOfferId(null);
  };

  const offerPlace = (offer: {
    address?: string;
    neighbourhood?: string;
  }) => offer.address || offer.neighbourhood || "";

  const selectedOffer = useMemo(
    () =>
      rankedOffers.find((o) => o.id === selectedOfferId) ||
      offers.find((o) => o.id === selectedOfferId) ||
      null,
    [rankedOffers, offers, selectedOfferId],
  );

  const browsedOffers = useMemo(() => {
    const sorted = sortRankedOffers(rankedOffers, browseSort, userPoint);
    const q = browseQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (o) =>
        o.vendorName.toLowerCase().includes(q) ||
        (o.neighbourhood || "").toLowerCase().includes(q) ||
        (o.address || "").toLowerCase().includes(q),
    );
  }, [rankedOffers, browseSort, browseQuery, userPoint]);

  // Auto road-distance quote once a vendor is selected + live location is ready
  useEffect(() => {
    if (!selectedOffer) {
      setDeliveryQuoteMajor(null);
      setDeliveryQuoteLabel(null);
      setDeliveryQuoting(false);
      return;
    }

    if (!coords) {
      setDeliveryQuoteMajor(null);
      setDeliveryQuoteLabel(null);
      setDeliveryQuoting(false);
      return;
    }

    const shops =
      selectedOffer.lat != null && selectedOffer.lng != null
        ? [{ lat: selectedOffer.lat, lng: selectedOffer.lng }]
        : [];

    let cancelled = false;
    const controller = new AbortController();
    setDeliveryQuoting(true);

    void (async () => {
      try {
        const res = await fetch("/api/checkout/delivery-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            fulfilment: "delivery",
            areaLabel: selectedOffer.neighbourhood || null,
            drop: { lat: coords.lat, lng: coords.lng },
            shops,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const minor = Number(json?.data?.deliveryMinor);
        if (Number.isFinite(minor)) {
          setDeliveryQuoteMajor(minor / 100);
          const km = Number(json?.data?.distanceKm) || 0;
          const eta = Number(json?.data?.etaMinutes) || 0;
          const adjs = Array.isArray(json?.data?.adjustments)
            ? (json.data.adjustments as Array<{
                label?: string;
                amountMajor?: number;
              }>)
            : [];
          const parts = [
            km > 0
              ? km < 1
                ? `${Math.round(km * 1000)} m`
                : `${km.toFixed(1)} km`
              : null,
            eta > 0 ? `~${eta} min` : null,
            ...adjs
              .filter((a) => a?.label && a?.amountMajor)
              .map((a) => `${a.label} +${a.amountMajor}`),
          ].filter(Boolean);
          setDeliveryQuoteLabel(parts.length ? parts.join(" · ") : null);
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setDeliveryQuoteMajor(null);
        setDeliveryQuoteLabel(null);
      } finally {
        if (!cancelled) setDeliveryQuoting(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedOffer, coords?.lat, coords?.lng]);

  const switchVendorHint = useMemo(() => {
    if (!selectedOfferId || !userPoint || rankedOffers.length < 2) return null;
    const selected = rankedOffers.find((o) => o.id === selectedOfferId);
    if (!selected || selected.distanceKm == null) return null;
    const better = rankedOffers.find(
      (o) =>
        o.id !== selected.id &&
        o.distanceKm != null &&
        o.distanceKm < selected.distanceKm! - 0.3 &&
        o.price <= selected.price * 1.05,
    );
    if (!better || better.distanceKm == null) return null;
    const deltaKm = selected.distanceKm - better.distanceKm;
    const save = Math.round(deltaKm * 40);
    if (save < 50) return null;
    return {
      offerId: better.id,
      vendorName: better.vendorName,
      saveMajor: save,
    };
  }, [selectedOfferId, rankedOffers, userPoint]);

  const addToCart = async (): Promise<boolean> => {
    if (!product || !selectedOffer) {
      showToast("Choose a vendor first", "error");
      return false;
    }
    if (!fulfilment) {
      showToast("Choose pickup or delivery", "error");
      return false;
    }
    if (fulfilment === "delivery" && !coords) {
      showToast("Allow location to calculate delivery", "error");
      trackLocation();
      return false;
    }
    if (fulfilment === "delivery" && deliveryQuoteMajor == null) {
      showToast("Calculating delivery… try again in a moment", "error");
      return false;
    }
    if (product.variations?.length) {
      const missing = product.variations.some(
        (v) => !selectedVariations[v.name],
      );
      if (missing) {
        showToast("Choose all product options first", "error");
        return false;
      }
    }
    if (selectedOffer.stock <= 0) {
      showToast("This option is out of stock", "error");
      return false;
    }
    if (product.status === "archived") {
      showToast("This product is no longer available", "error");
      return false;
    }
    if (authLoading) await new Promise((r) => setTimeout(r, 300));
    setIsAddingToCart(true);
    try {
      const cartProduct: Product = {
        ...product,
        price: selectedOffer.price,
        stock: selectedOffer.stock,
        vendorName: selectedOffer.vendorName,
        neighbourhood: selectedOffer.neighbourhood,
      };
      const ok = await addToCartHook(cartProduct, quantity, {
        offerId: selectedOffer.id,
        offerPrice: selectedOffer.price,
        vendorId: selectedOffer.vendorId,
        vendorName: selectedOffer.vendorName,
        neighbourhood: selectedOffer.neighbourhood,
        stock: selectedOffer.stock,
        fulfilment,
        deliveryZoneLabel:
          fulfilment === "delivery" ? "Your location" : undefined,
        deliveryFee: fulfilment === "delivery" ? deliveryQuoteMajor ?? 0 : 0,
        variantPublicId: selectedOffer.variantPublicId || undefined,
      });
      if (!ok) {
        showToast("Failed to add", "error");
        return false;
      }
      showToast(`${product.name} added to bag`, "success");
      const recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
      localStorage.setItem(
        "recentlyViewed",
        JSON.stringify(
          [
            product,
            ...recent.filter((p: Product) => p.id !== product.id),
          ].slice(0, 5),
        ),
      );
      return true;
    } catch (error: unknown) {
      showToast(
        error instanceof Error ? error.message : "Failed to add",
        "error",
      );
      return false;
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    try {
      const ok = await addToCart();
      if (ok) {
        window.location.href = "/checkout";
      }
    } catch {
      // Stay on PDP — add failed
    }
  };

  const availableOffers = rankedOffers;

  const mapOffers = useMemo(() => {
    const byId = new Map<string, RankedOffer>();
    for (const o of topOffers) byId.set(o.id, o);
    if (selectedOfferId) {
      const sel = rankedOffers.find((o) => o.id === selectedOfferId);
      if (sel) byId.set(sel.id, sel);
    }
    return [...byId.values()];
  }, [topOffers, rankedOffers, selectedOfferId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
          Connecting
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#f7f7f5] px-6 text-center">
        <p className="text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-tight">
          Product not found
        </p>
        <Link
          href="/shop"
          className="mt-6 text-[14px] underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
        >
          Back to shop →
        </Link>
      </div>
    );
  }

  const rating = product.rating || 0;
  const reviewCount = product.reviewCount || 0;
  const productImages = Array.isArray(product.images) ? product.images : [];
  const mainImage =
    product.image &&
    typeof product.image === "string" &&
    product.image.trim() !== ""
      ? product.image
      : null;
  const images = [...productImages, mainImage].filter(
    (img): img is string => img != null && img.trim() !== "",
  );
  const stock = selectedOffer?.stock ?? 0;

  return (
    <div className="min-h-screen w-full bg-[#f7f7f5] text-black">
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-16 sm:pt-10 md:px-10 lg:px-14 lg:pb-20 xl:px-20">
        <Breadcrumbs
          items={[
            {
              label: product.category,
              href: `/shop?category=${encodeURIComponent(product.category)}`,
            },
            { label: product.name },
          ]}
        />

        {/* Hero: image + buy */}
        <div className="mt-10 grid grid-cols-1 items-start gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-16 xl:gap-20">
          <div className="lg:col-span-7">
            <ImageGallery images={images} productName={product.name} />
          </div>

          <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
              {product.category}
            </p>

            <h1 className="mt-4 text-[clamp(1.85rem,3.5vw,2.85rem)] font-medium leading-[1.08] tracking-tight">
              {product.name}
            </h1>

            {rating > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (!selectedOfferId) {
                    showToast("Select a vendor to see reviews", "error");
                    return;
                  }
                  setActiveTab("reviews");
                  document
                    .getElementById("product-info")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-4 inline-block text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/15 hover:text-black hover:decoration-black"
              >
                {rating.toFixed(1)} · {reviewCount} ratings
              </button>
            ) : null}

            {/* Vendors — pick one (or none) */}
            <section
              className="mt-10 border-t border-black/[0.08] pt-8"
              id="product-vendors"
            >
              <div className="mb-5 flex items-end justify-between gap-4">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                  Choose a shop
                </h2>
                <p className="text-[12px] text-black/35">
                  {availableOffers.length} available
                </p>
              </div>

              {availableOffers.length === 0 ? (
                <p className="py-4 text-[14px] text-black/45">
                  No vendors available right now.
                </p>
              ) : (
                <div>
                  <ul className="border-t border-black/[0.06]" role="listbox">
                    {topOffers.map((offer) => {
                      const active = selectedOfferId === offer.id;
                      const place = offerPlace(offer);
                      return (
                        <li key={offer.id} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onClick={() => selectOffer(offer.id)}
                            className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-black/[0.06] py-4 text-left transition-colors ${
                              active
                                ? "bg-black/[0.03]"
                                : "hover:bg-black/[0.015]"
                            }`}
                          >
                            <span
                              className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                active
                                  ? "border-black"
                                  : "border-black/25"
                              }`}
                              aria-hidden
                            >
                              {active ? (
                                <span className="h-2 w-2 rounded-full bg-black" />
                              ) : null}
                            </span>
                            <span className="min-w-0">
                              <span
                                className={`block text-[15px] font-medium tracking-tight ${
                                  active ? "text-black" : "text-black/80"
                                }`}
                              >
                                {offer.vendorName}
                              </span>
                              {place ? (
                                <span className="mt-1 block text-[12px] leading-snug text-black/40">
                                  {place}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`shrink-0 pt-0.5 text-right text-[15px] font-medium tabular-nums ${
                                active ? "text-black" : "text-black/50"
                              }`}
                            >
                              {formatPrice(offer.price)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    {availableOffers.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBrowseSort(userPoint ? "best" : "cheapest");
                          setBrowseQuery("");
                          setBrowseOpen(true);
                        }}
                        className="text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/15 transition-colors hover:text-black hover:decoration-black"
                      >
                        Browse all {availableOffers.length} vendors
                      </button>
                    ) : (
                      <span />
                    )}
                    {selectedOfferId ? (
                      <button
                        type="button"
                        onClick={clearOffer}
                        className="text-[13px] text-black/40 transition-colors hover:text-black"
                      >
                        Clear selection
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            {/* Price follows selected vendor offer */}
            <div className="mt-8">
              {selectedOffer ? (
                <>
                  <p className="text-[clamp(1.75rem,3vw,2.25rem)] font-medium tracking-tight tabular-nums">
                    {formatPrice(selectedOffer.price)}
                  </p>
                  <p className="mt-2 text-[13px] text-black/40">
                    At{" "}
                    <Link
                      href={`/vendors/${resolveVendorSlug({
                        id: selectedOffer.vendorId,
                        name: selectedOffer.vendorName,
                      })}`}
                      className="underline underline-offset-[4px] decoration-black/20 hover:decoration-black"
                    >
                      {selectedOffer.vendorName}
                    </Link>
                    {selectedOffer.neighbourhood
                      ? ` · ${selectedOffer.neighbourhood}`
                      : ""}
                  </p>
                </>
              ) : (
                <p className="text-[15px] text-black/45">
                  Pick a shop to see price
                </p>
              )}
            </div>

            {product.variations && product.variations.length > 0 ? (
              <div className="mt-8 space-y-6">
                {product.variations.map((variation) => (
                  <div key={variation.name}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[13px] text-black/50">
                        <span className="font-medium text-black">
                          {variation.name}
                        </span>
                        {" · "}
                        {selectedVariations[variation.name]}
                      </p>
                      {variation.name === "Size" ? (
                        <SizeGuide category={product.category} />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {variation.options.map((option) => {
                        const on =
                          selectedVariations[variation.name] === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setSelectedVariations({
                                ...selectedVariations,
                                [variation.name]: option,
                              })
                            }
                            className={`min-h-11 px-2 text-[14px] transition-colors ${
                              on
                                ? "font-medium text-black underline underline-offset-[5px]"
                                : "text-black/40 hover:text-black"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {selectedOffer ? (
              <section className="mt-6" id="product-fulfilment">
                <div className="flex items-center gap-1 border border-black/10 p-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setFulfilment((prev) =>
                        prev === "pickup" ? null : "pickup",
                      )
                    }
                    className={cn(
                      "flex min-h-9 flex-1 items-center justify-center gap-2 px-2 text-[12px] transition-colors",
                      fulfilment === "pickup"
                        ? "bg-black text-white"
                        : "text-black/50 hover:text-black",
                    )}
                  >
                    <span className="font-medium tracking-tight">Pickup</span>
                    <span
                      className={
                        fulfilment === "pickup"
                          ? "text-white/70"
                          : "text-black/35"
                      }
                    >
                      Free
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (fulfilment === "delivery") {
                        setFulfilment(null);
                        return;
                      }
                      if (!coords) trackLocation();
                      setFulfilment("delivery");
                    }}
                    className={cn(
                      "flex min-h-9 flex-1 items-center justify-center gap-2 px-2 text-[12px] transition-colors",
                      fulfilment === "delivery"
                        ? "bg-black text-white"
                        : "text-black/50 hover:text-black",
                    )}
                  >
                    <span className="font-medium tracking-tight">Delivery</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        fulfilment === "delivery"
                          ? "text-white/70"
                          : "text-black/35",
                      )}
                    >
                      {!coords
                        ? locationStatus === "locating"
                          ? "…"
                          : "GPS"
                        : deliveryQuoting
                          ? "…"
                          : deliveryQuoteMajor != null
                            ? formatPrice(deliveryQuoteMajor)
                            : "—"}
                    </span>
                  </button>
                </div>
                {fulfilment === "delivery" ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] text-black/35">
                      {!coords ? (
                        <>
                          Using your live location.{" "}
                          <button
                            type="button"
                            onClick={() => trackLocation()}
                            className="underline underline-offset-2 hover:text-black"
                          >
                            Enable GPS
                          </button>
                        </>
                      ) : deliveryQuoteLabel ? (
                        <>To you · {deliveryQuoteLabel}</>
                      ) : deliveryQuoting ? (
                        <>Calculating from your location…</>
                      ) : (
                        <>To your live location</>
                      )}
                    </p>
                    {switchVendorHint ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedOfferId(switchVendorHint.offerId)
                        }
                        className="block w-full text-left text-[12px] leading-snug text-black/55 underline underline-offset-2 decoration-black/20 hover:text-black hover:decoration-black"
                      >
                        Buy from {switchVendorHint.vendorName} instead. Save{" "}
                        {formatPrice(switchVendorHint.saveMajor)} on delivery.
                      </button>
                    ) : null}
                  </div>
                ) : fulfilment === "pickup" ? (
                  <p className="mt-2 text-[11px] text-black/35">
                    Free click &amp; collect — you&apos;ll get a receipt after
                    payment.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-black/35">
                    Choose pickup or delivery before adding to bag.
                  </p>
                )}
              </section>
            ) : null}

            {selectedOffer && stock > 0 ? (
              <div className="mt-8 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex items-center border-b border-black/20">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-11 w-11 items-center justify-center text-black/45 hover:text-black"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <span className="min-w-[2rem] text-center text-[14px] font-medium tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(Math.min(stock, 10), q + 1))
                      }
                      className="flex h-11 w-11 items-center justify-center text-black/45 hover:text-black"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                  <p className="text-[13px] text-black/40">
                    {stock <= 5 ? `Only ${stock} left` : "In stock"}
                    {fulfilment === "delivery" && deliveryQuoteMajor != null
                      ? ` · +${formatPrice(deliveryQuoteMajor)} delivery`
                      : ""}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={
                      isAddingToCart ||
                      !fulfilment ||
                      (fulfilment === "delivery" &&
                        (deliveryQuoteMajor == null || !coords))
                    }
                    className="min-h-12 bg-black py-4 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80 disabled:opacity-50 sm:text-[13px] sm:tracking-[0.16em]"
                  >
                    {isAddingToCart ? "Adding…" : "Add to bag"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={
                      isAddingToCart ||
                      !fulfilment ||
                      (fulfilment === "delivery" &&
                        (deliveryQuoteMajor == null || !coords))
                    }
                    className="min-h-12 border border-black/20 py-4 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors hover:border-black hover:bg-black hover:text-white disabled:opacity-50 sm:text-[13px] sm:tracking-[0.16em]"
                  >
                    Buy now
                  </button>
                </div>

                <WishlistButton product={product} showToast={showToast} />
              </div>
            ) : selectedOffer ? (
              <div className="mt-8 space-y-5">
                <p className="text-[14px] text-black/45">
                  Out of stock with this vendor
                </p>
                <WishlistButton product={product} showToast={showToast} />
              </div>
            ) : (
              <div className="mt-8 space-y-5">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("product-vendors")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                  className="min-h-12 w-full border border-black/20 py-4 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors hover:border-black hover:bg-black hover:text-white sm:text-[13px] sm:tracking-[0.16em]"
                >
                  Select a vendor
                </button>
                <WishlistButton product={product} showToast={showToast} />
              </div>
            )}
          </div>
        </div>

        {/* Vendor-specific: Details / Location / Reviews / Questions */}
        <section className="mt-24 lg:mt-32" id="product-info">
          {!selectedOffer ? (
            <div className="border-t border-black/[0.06] pt-14 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                Vendor details
              </p>
              <h2 className="mt-4 text-[clamp(1.35rem,2.5vw,1.85rem)] font-medium tracking-tight">
                Select a vendor to continue
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-black/45">
                Details, exact pickup location, reviews and questions are shown
                for the vendor you choose.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black/[0.06] pb-6">
                <div className="flex flex-wrap gap-x-8 gap-y-3 sm:gap-x-10">
                  {(
                    [
                      ["details", "Details"],
                      ["location", "Location"],
                      ["reviews", "Reviews"],
                      ["questions", "Questions"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={`pb-1 text-[15px] tracking-tight transition-colors ${
                        activeTab === key
                          ? "font-medium text-black"
                          : "text-black/35 hover:text-black"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-black/30">
                  {selectedOffer.vendorName}
                  {selectedOffer.neighbourhood
                    ? ` · ${selectedOffer.neighbourhood}`
                    : ""}
                </p>
              </div>

              <div
                className={`mt-12 ${activeTab === "location" ? "max-w-none" : "max-w-4xl"}`}
                id={activeTab === "reviews" ? "reviews" : undefined}
              >
                {activeTab === "details" ? (
                  <div className="space-y-16">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                        Order summary
                      </p>
                      <dl className="mt-5 grid gap-0 sm:grid-cols-2 sm:gap-x-12">
                        {[
                          { label: "Product", value: product.name },
                          { label: "Category", value: product.category },
                          {
                            label: "Vendor",
                            value: selectedOffer.vendorName,
                          },
                          {
                            label: "Price",
                            value: formatPrice(selectedOffer.price),
                          },
                          {
                            label: "Availability",
                            value:
                              selectedOffer.stock > 0
                                ? `${selectedOffer.stock} in stock`
                                : "Out of stock",
                          },
                          {
                            label: "Area",
                            value: selectedOffer.neighbourhood || "Nairobi",
                          },
                          ...(selectedOffer.address
                            ? [
                                {
                                  label: "Address",
                                  value: selectedOffer.address,
                                },
                              ]
                            : []),
                          ...(Object.keys(selectedVariations).length
                            ? Object.entries(selectedVariations).map(
                                ([name, value]) => ({
                                  label: name,
                                  value,
                                }),
                              )
                            : []),
                        ].map((row) => (
                          <div
                            key={`${row.label}-${row.value}`}
                            className="flex items-baseline justify-between gap-6 border-b border-black/[0.06] py-4"
                          >
                            <dt className="text-[13px] text-black/35">
                              {row.label}
                            </dt>
                            <dd className="text-right text-[14px] font-medium tracking-tight text-black/80">
                              {row.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
                      <div className="lg:col-span-7">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                          About this product
                        </p>
                        <p className="mt-5 whitespace-pre-line text-[16px] leading-[1.8] text-black/60">
                          {product.longDescription || product.description}
                        </p>
                      </div>
                      <div className="lg:col-span-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                          Collect from
                        </p>
                        <div className="mt-5 border border-black/[0.08] bg-white p-5">
                          <p className="text-[17px] font-medium tracking-tight">
                            {selectedOffer.vendorName}
                          </p>
                          <p className="mt-2 text-[14px] leading-relaxed text-black/50">
                            {[
                              selectedOffer.address,
                              selectedOffer.neighbourhood,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Nairobi pickup"}
                          </p>
                          <div className="mt-6">
                            <Link
                              href={`/vendors/${resolveVendorSlug({
                                id: selectedOffer.vendorId,
                                name: selectedOffer.vendorName,
                              })}`}
                              className="text-[13px] font-medium underline underline-offset-[5px] decoration-black/25 hover:decoration-black"
                            >
                              Store page →
                            </Link>
                          </div>
                        </div>
                    <p className="mt-6 text-[13px] leading-relaxed text-black/40">
                      Pay on KlikCollect, then collect in person or get it
                      delivered same day in Nairobi.
                    </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "location" ? (
                  <div className="space-y-6">
                    <MapPreview
                      variant="tab"
                      selectedOfferId={selectedOfferId}
                      offers={mapOffers.map((o) => ({
                        id: o.id,
                        vendorId: o.vendorId,
                        vendorName: o.vendorName,
                        neighbourhood: o.neighbourhood,
                        address: o.address,
                        lng: o.lng,
                        lat: o.lat,
                      }))}
                    />
                    <ul className="divide-y divide-black/[0.06] border-y border-black/[0.06]">
                      {mapOffers.map((o) => (
                        <li
                          key={o.id}
                          className={
                            o.id === selectedOfferId
                              ? "py-4 text-black"
                              : "py-4 text-black/50"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedOfferId(o.id)}
                            className="w-full text-left"
                          >
                            <p className="text-[15px] font-medium">
                              {o.vendorName}
                            </p>
                            <p className="mt-1 text-[13px] text-black/45">
                              {[o.address, o.neighbourhood]
                                .filter(Boolean)
                                .join(", ") || "Address on request"}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeTab === "reviews" ? (
                  <ProductReviews
                    key={`reviews-${selectedOffer.vendorId}`}
                    productId={product.id}
                    vendorName={selectedOffer.vendorName}
                  />
                ) : null}

                {activeTab === "questions" ? (
                  <ProductQuestions
                    key={`questions-${selectedOffer.vendorId}`}
                    productId={product.id}
                    vendorName={selectedOffer.vendorName}
                  />
                ) : null}
              </div>
            </>
          )}
        </section>

        {/* Related */}
        <div className="mt-24 lg:mt-32">
          <RelatedProducts
            currentProductId={product.id}
            category={product.category}
          />
        </div>
      </div>

      {sheetMounted && browseOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Browse vendors"
              className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
                browseVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col px-5 sm:px-8 lg:px-12">
                <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
                    Vendors
                  </p>
                  <button
                    type="button"
                    onClick={() => setBrowseOpen(false)}
                    className="group inline-flex items-center gap-2 text-[13px] text-black/45 transition-colors hover:text-black"
                    aria-label="Close vendors"
                  >
                    <span className="hidden sm:inline">Esc</span>
                    <CloseIcon size={20} />
                  </button>
                </header>

                <div
                  className={`mt-6 shrink-0 transition-all duration-500 ease-out sm:mt-8 ${
                    browseVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-2 opacity-0"
                  }`}
                >
                  <label className="sr-only" htmlFor="kc-vendor-search">
                    Search shops
                  </label>
                  <div className="group relative flex items-center border-b border-black/15 transition-colors focus-within:border-black/50">
                    <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-black/30 transition-colors group-focus-within:text-black/55">
                      <SearchIcon size={18} />
                    </span>
                    <input
                      id="kc-vendor-search"
                      type="search"
                      autoComplete="off"
                      spellCheck={false}
                      value={browseQuery}
                      onChange={(e) => setBrowseQuery(e.target.value)}
                      placeholder="Search shop or area"
                      className="w-full bg-transparent py-4 pl-8 pr-16 text-[clamp(1.25rem,2.8vw,1.75rem)] font-medium tracking-tight text-black placeholder:font-normal placeholder:text-black/30 outline-none sm:py-5 sm:pl-9 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {browseQuery ? (
                      <button
                        type="button"
                        onClick={() => setBrowseQuery("")}
                        className="absolute right-0 top-1/2 -translate-y-1/2 px-2 py-1 text-[12px] text-black/40 transition-colors hover:text-black"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[12px] text-black/35">
                    {availableOffers.length} selling this item
                    {browseQuery.trim()
                      ? ` · ${browsedOffers.length} match${
                          browsedOffers.length === 1 ? "" : "es"
                        }`
                      : ""}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                    {(
                      [
                        ["best", "Best"],
                        ["nearest", "Nearest"],
                        ["cheapest", "Cheapest"],
                        ["area", "Area"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        disabled={id === "nearest" && !userPoint}
                        onClick={() => setBrowseSort(id)}
                        className={`text-[12px] font-medium uppercase tracking-[0.14em] disabled:opacity-30 ${
                          browseSort === id
                            ? "text-black underline underline-offset-[5px]"
                            : "text-black/35 hover:text-black"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <ul
                  className={`scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-16 pt-10 transition-all duration-500 ease-out sm:pt-12 ${
                    browseVisible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-3 opacity-0"
                  }`}
                >
                  {browsedOffers.length === 0 ? (
                    <li className="py-8 text-[14px] text-black/40">
                      No vendors match that search.
                    </li>
                  ) : (
                    browsedOffers.map((offer) => {
                      const active = selectedOfferId === offer.id;
                      const place = offerPlace(offer);
                      return (
                        <li key={offer.id}>
                          <button
                            type="button"
                            onClick={() => selectOffer(offer.id)}
                            className={`grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-black/[0.06] py-4 text-left transition-colors ${
                              active
                                ? "bg-black/[0.03]"
                                : "hover:bg-black/[0.015]"
                            }`}
                          >
                            <span
                              className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                active ? "border-black" : "border-black/25"
                              }`}
                              aria-hidden
                            >
                              {active ? (
                                <span className="h-2 w-2 rounded-full bg-black" />
                              ) : null}
                            </span>
                            <span className="min-w-0">
                              <span
                                className={`block text-[16px] font-medium tracking-tight ${
                                  active ? "text-black" : "text-black/80"
                                }`}
                              >
                                {offer.vendorName}
                              </span>
                              {place ? (
                                <span className="mt-1 block text-[13px] leading-snug text-black/40">
                                  {place}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className={`shrink-0 pt-0.5 text-[15px] font-medium tabular-nums ${
                                active ? "text-black" : "text-black/50"
                              }`}
                            >
                              {formatPrice(offer.price)}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">
            Connecting
          </p>
        </div>
      }
    >
      <ProductPageInner />
    </Suspense>
  );
}
