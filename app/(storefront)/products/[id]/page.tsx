"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FulfilmentMethod, Product, ProductOffer, ProductVariation } from "@/types";
import { ChevronDown, Minus, Plus } from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedProducts from "@/components/RelatedProducts";
import ImageGallery from "@/components/ImageGallery";
import WishlistButton from "@/components/WishlistButton";
import ProductReviews from "@/components/ProductReviews";
import ProductQuestions from "@/components/ProductQuestions";
import SizeGuide from "@/components/SizeGuide";
import { useToast } from "@/components/ToastProvider";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { useCart } from "@/lib/hooks/useCart";
import { formatPrice } from "@/lib/currency";
import { resolveVendorSlug } from "@/lib/vendor-slug";
import MapPreview from "@/components/map/MapPreview";

type TabType = "details" | "location" | "reviews" | "questions";

function ProductPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { loading: authLoading } = useUserAuth();
  const { addToCart: addToCartHook } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [offers, setOffers] = useState<ProductOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>("pickup");
  const [moreVendorsOpen, setMoreVendorsOpen] = useState(false);

  const prefillOffer = searchParams.get("offer");

  useEffect(() => {
    if (!selectedOfferId && activeTab !== "details") {
      setActiveTab("details");
    }
  }, [selectedOfferId, activeTab]);

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
        const list: ProductOffer[] = Array.isArray(data.offers) ? data.offers : [];
        setOffers(list);
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

  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === selectedOfferId) || null,
    [offers, selectedOfferId],
  );

  const addToCart = async () => {
    if (!product || !selectedOffer) {
      showToast("Choose a vendor first", "error");
      return;
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
      await addToCartHook(cartProduct, quantity, {
        offerId: selectedOffer.id,
        offerPrice: selectedOffer.price,
        vendorId: selectedOffer.vendorId,
        vendorName: selectedOffer.vendorName,
        neighbourhood: selectedOffer.neighbourhood,
        fulfilment,
      });
      showToast(`${product.name} added to bag`, "success");
      const recent = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
      localStorage.setItem(
        "recentlyViewed",
        JSON.stringify(
          [product, ...recent.filter((p: Product) => p.id !== product.id)].slice(0, 5),
        ),
      );
    } catch (error: unknown) {
      showToast(error instanceof Error ? error.message : "Failed to add", "error");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    await addToCart();
    if (selectedOffer) router.push("/checkout");
  };

  const availableOffers = useMemo(
    () => offers.filter((o) => o.stock > 0),
    [offers],
  );

  const { visibleOffers, hiddenOffers } = useMemo(() => {
    if (availableOffers.length <= 2) {
      return { visibleOffers: availableOffers, hiddenOffers: [] as ProductOffer[] };
    }
    const top = availableOffers.slice(0, 2);
    if (!selectedOfferId || top.some((o) => o.id === selectedOfferId)) {
      return {
        visibleOffers: top,
        hiddenOffers: availableOffers.slice(2),
      };
    }
    const selected = availableOffers.find((o) => o.id === selectedOfferId);
    const rest = availableOffers.filter((o) => o.id !== selectedOfferId);
    const visible = [selected, rest[0]].filter(Boolean) as ProductOffer[];
    const hidden = rest.slice(1);
    return { visibleOffers: visible, hiddenOffers: hidden };
  }, [availableOffers, selectedOfferId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Connecting</p>
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
    product.image && typeof product.image === "string" && product.image.trim() !== ""
      ? product.image
      : null;
  const images = [...productImages, mainImage].filter(
    (img): img is string => img != null && img.trim() !== "",
  );
  const stock = selectedOffer?.stock ?? 0;

  return (
    <div className="min-h-screen w-full bg-[#f7f7f5] text-black">
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-32 pt-6 sm:px-6 sm:pb-20 sm:pt-10 md:px-10 lg:px-14 xl:px-20">
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

            {/* How you get it — choose before buying */}
            <section className="mt-10">
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                How you get it
              </h2>
              <div
                className="grid grid-cols-1 border border-black/[0.1] min-[400px]:grid-cols-2"
                role="group"
                aria-label="Fulfilment method"
              >
                <button
                  type="button"
                  onClick={() => setFulfilment("pickup")}
                  className={`min-h-14 px-4 py-3.5 text-left transition-colors ${
                    fulfilment === "pickup"
                      ? "bg-black text-white"
                      : "bg-transparent text-black/55 hover:text-black"
                  }`}
                >
                  <span className="block text-[14px] font-medium tracking-tight">
                    Click &amp; collect
                  </span>
                  <span
                    className={`mt-1 block text-[12px] ${
                      fulfilment === "pickup" ? "text-white/65" : "text-black/35"
                    }`}
                  >
                    Pick up at the store
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfilment("delivery")}
                  className={`min-h-14 border-t border-black/[0.1] px-4 py-3.5 text-left transition-colors min-[400px]:border-l min-[400px]:border-t-0 ${
                    fulfilment === "delivery"
                      ? "bg-black text-white"
                      : "bg-transparent text-black/55 hover:text-black"
                  }`}
                >
                  <span className="block text-[14px] font-medium tracking-tight">
                    Delivery
                  </span>
                  <span
                    className={`mt-1 block text-[12px] ${
                      fulfilment === "delivery" ? "text-white/65" : "text-black/35"
                    }`}
                  >
                    Fee at checkout
                  </span>
                </button>
              </div>
            </section>

            {/* Vendors — 2 shown, rest in dropdown */}
            <section className="mt-10" id="product-vendors">
              <div className="mb-3 flex items-end justify-between gap-4">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                  Vendor
                </h2>
                <p className="text-[12px] text-black/35">
                  {availableOffers.length} available
                </p>
              </div>

              {availableOffers.length === 0 ? (
                <p className="py-6 text-[14px] text-black/45">
                  No vendors available right now.
                </p>
              ) : (
                <div>
                  <ul>
                    {visibleOffers.map((offer) => {
                      const active = selectedOfferId === offer.id;
                      return (
                        <li key={offer.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOfferId(offer.id);
                              setMoreVendorsOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-4 border-b border-black/[0.06] py-4 text-left transition-colors ${
                              active ? "opacity-100" : "opacity-70 hover:opacity-100"
                            }`}
                          >
                            <span className="min-w-0">
                              <span
                                className={`block text-[15px] font-medium tracking-tight ${
                                  active ? "text-black" : "text-black/75"
                                }`}
                              >
                                {offer.vendorName}
                              </span>
                              {offer.neighbourhood || offer.address ? (
                                <span className="mt-0.5 block text-[12px] text-black/40">
                                  {offer.address || offer.neighbourhood}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 text-right">
                              <span
                                className={`block text-[15px] font-medium tabular-nums ${
                                  active ? "text-black" : "text-black/50"
                                }`}
                              >
                                {formatPrice(offer.price)}
                              </span>
                              {active ? (
                                <span className="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-black/40">
                                  Selected
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {hiddenOffers.length > 0 ? (
                    <div className="relative mt-1">
                      <button
                        type="button"
                        onClick={() => setMoreVendorsOpen((v) => !v)}
                        className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-[13px] text-black/45 transition-colors hover:text-black"
                        aria-expanded={moreVendorsOpen}
                      >
                        <span>
                          {moreVendorsOpen
                            ? "Hide other vendors"
                            : `More vendors (${hiddenOffers.length})`}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${
                            moreVendorsOpen ? "rotate-180" : ""
                          }`}
                          strokeWidth={1.75}
                        />
                      </button>
                      {moreVendorsOpen ? (
                        <ul className="border border-black/[0.08] bg-[var(--kc-canvas)]">
                          {hiddenOffers.map((offer) => {
                            const active = selectedOfferId === offer.id;
                            return (
                              <li key={offer.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedOfferId(offer.id);
                                    setMoreVendorsOpen(false);
                                  }}
                                  className="flex w-full items-center justify-between gap-4 border-b border-black/[0.06] px-3 py-3.5 text-left last:border-b-0 hover:bg-black/[0.02]"
                                >
                                  <span className="min-w-0">
                                    <span
                                      className={`block text-[14px] font-medium tracking-tight ${
                                        active ? "text-black" : "text-black/75"
                                      }`}
                                    >
                                      {offer.vendorName}
                                    </span>
                                    {offer.neighbourhood || offer.address ? (
                                      <span className="mt-0.5 block text-[12px] text-black/40">
                                        {offer.address || offer.neighbourhood}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="shrink-0 text-[14px] font-medium tabular-nums text-black/55">
                                    {formatPrice(offer.price)}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            {/* Price after vendor */}
            <div className="mt-8">
              {selectedOffer ? (
                <>
                  <p className="text-[clamp(1.75rem,3vw,2.25rem)] font-medium tracking-tight tabular-nums">
                    {formatPrice(selectedOffer.price)}
                  </p>
                  <p className="mt-2 text-[13px] text-black/40">
                    From{" "}
                    <Link
                      href={`/vendors/${resolveVendorSlug({
                        id: selectedOffer.vendorId,
                        name: selectedOffer.vendorName,
                      })}`}
                      className="underline underline-offset-[4px] decoration-black/20 hover:decoration-black"
                    >
                      {selectedOffer.vendorName}
                    </Link>
                    {fulfilment === "pickup" && selectedOffer.neighbourhood
                      ? ` · Collect in ${selectedOffer.neighbourhood}`
                      : fulfilment === "delivery"
                        ? " · Delivery"
                        : ""}
                  </p>
                </>
              ) : (
                <p className="text-[15px] text-black/45">Select a vendor to see price</p>
              )}
            </div>

            {product.variations && product.variations.length > 0 ? (
              <div className="mt-8 space-y-6">
                {product.variations.map((variation) => (
                  <div key={variation.name}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[13px] text-black/50">
                        <span className="font-medium text-black">{variation.name}</span>
                        {" · "}
                        {selectedVariations[variation.name]}
                      </p>
                      {variation.name === "Size" ? (
                        <SizeGuide category={product.category} />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      {variation.options.map((option) => {
                        const on = selectedVariations[variation.name] === option;
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
                  </p>
                </div>

                <div className="hidden grid-cols-2 gap-3 sm:grid">
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={isAddingToCart}
                    className="bg-black py-4 text-[12px] font-medium uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80 disabled:opacity-50 sm:text-[13px] sm:tracking-[0.16em]"
                  >
                    {isAddingToCart ? "Adding…" : "Add to bag"}
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={isAddingToCart}
                    className="border border-black/20 py-4 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors hover:border-black hover:bg-black hover:text-white disabled:opacity-50 sm:text-[13px] sm:tracking-[0.16em]"
                  >
                    Buy now
                  </button>
                </div>

                <WishlistButton product={product} showToast={showToast} />
              </div>
            ) : selectedOffer ? (
              <div className="mt-8 space-y-5">
                <p className="text-[14px] text-black/45">Out of stock with this vendor</p>
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
                  className="hidden w-full border border-black/20 py-4 text-[13px] font-medium uppercase tracking-[0.16em] transition-colors hover:border-black hover:bg-black hover:text-white sm:block"
                >
                  Select a vendor
                </button>
                <WishlistButton product={product} showToast={showToast} />
              </div>
            )}
          </div>
        </div>

        {/* Mobile sticky buy bar — sits above bottom nav */}
        {selectedOffer && stock > 0 ? (
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[85] border-t border-black/10 bg-[#f7f7f5]/95 px-4 py-3 backdrop-blur-md sm:hidden">
            <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-2">
              <button
                type="button"
                onClick={addToCart}
                disabled={isAddingToCart}
                className="min-h-12 bg-black text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                {isAddingToCart ? "Adding…" : "Add to bag"}
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={isAddingToCart}
                className="min-h-12 border border-black/20 text-[11px] font-medium uppercase tracking-[0.12em] disabled:opacity-50"
              >
                Buy now
              </button>
            </div>
          </div>
        ) : !selectedOffer ? (
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[85] border-t border-black/10 bg-[#f7f7f5]/95 px-4 py-3 backdrop-blur-md sm:hidden">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("product-vendors")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="mx-auto flex min-h-12 w-full max-w-[1600px] items-center justify-center bg-black text-[11px] font-medium uppercase tracking-[0.12em] text-white"
            >
              Select a vendor
            </button>
          </div>
        ) : null}

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
                            label: "Fulfilment",
                            value: fulfilment === "delivery"
                              ? "Delivery"
                              : "Click & collect",
                          },
                          {
                            label: "Area",
                            value:
                              selectedOffer.neighbourhood || "Nairobi",
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
                            {[selectedOffer.address, selectedOffer.neighbourhood]
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
                          Pay on KlikCollect, then collect in person from this
                          vendor. Reviews and questions below are for this
                          seller.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === "location" ? (
                  <MapPreview
                    variant="tab"
                    selectedOfferId={selectedOfferId}
                    offers={availableOffers.map((o) => ({
                      id: o.id,
                      vendorId: o.vendorId,
                      vendorName: o.vendorName,
                      neighbourhood: o.neighbourhood,
                      address: o.address,
                      lng: o.lng,
                      lat: o.lat,
                    }))}
                  />
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
          <RelatedProducts currentProductId={product.id} category={product.category} />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-black/40">Connecting</p>
        </div>
      }
    >
      <ProductPageInner />
    </Suspense>
  );
}
