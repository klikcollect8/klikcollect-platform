"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FulfilmentMethod, Product, ProductOffer, ProductVariation } from "@/types";
import { Minus, Plus } from "lucide-react";
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

type TabType = "details" | "reviews" | "questions";

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

  const prefillOffer = searchParams.get("offer");

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
  const availableOffers = offers.filter((o) => o.stock > 0);

  return (
    <div className="min-h-screen w-full bg-[#f7f7f5] text-black">
      <div className="mx-auto w-full max-w-[1600px] px-6 pb-20 pt-8 sm:px-10 sm:pt-10 lg:px-14 xl:px-20">
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
              <Link
                href="#reviews"
                className="mt-4 inline-block text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/15 hover:text-black hover:decoration-black"
              >
                {rating.toFixed(1)} · {reviewCount} ratings
              </Link>
            ) : null}

            {/* Vendors */}
            <section className="mt-10">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                  Vendors
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
                <ul>
                  {availableOffers.map((offer) => {
                    const active = selectedOfferId === offer.id;
                    return (
                      <li key={offer.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedOfferId(offer.id)}
                          className="flex w-full items-center justify-between gap-4 border-b border-black/[0.06] py-4 text-left transition-opacity hover:opacity-55"
                        >
                          <span className="min-w-0">
                            <span
                              className={`block text-[15px] font-medium tracking-tight ${
                                active ? "text-black" : "text-black/75"
                              }`}
                            >
                              {offer.vendorName}
                            </span>
                            {offer.neighbourhood ? (
                              <span className="mt-0.5 block text-[12px] text-black/40">
                                {offer.neighbourhood}
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
              )}
            </section>

            {/* Price + actions after vendor */}
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
                  </p>
                </>
              ) : (
                <p className="text-[15px] text-black/45">Select a vendor to see price</p>
              )}
            </div>

            <div className="mt-8">
              <p className="text-[13px] text-black/50">
                <span className="font-medium text-black">Get it</span>
                {" · "}
                {fulfilment === "pickup"
                  ? selectedOffer?.neighbourhood
                    ? `Collect in ${selectedOffer.neighbourhood}`
                    : "Click & collect"
                  : "Delivery · fee at checkout"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                <button
                  type="button"
                  onClick={() => setFulfilment("pickup")}
                  className={`text-[14px] transition-colors ${
                    fulfilment === "pickup"
                      ? "font-medium text-black underline underline-offset-[5px]"
                      : "text-black/40 hover:text-black"
                  }`}
                >
                  Click &amp; collect
                </button>
                <button
                  type="button"
                  onClick={() => setFulfilment("delivery")}
                  className={`text-[14px] transition-colors ${
                    fulfilment === "delivery"
                      ? "font-medium text-black underline underline-offset-[5px]"
                      : "text-black/40 hover:text-black"
                  }`}
                >
                  Delivery
                </button>
              </div>
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
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
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
                            className={`text-[14px] transition-colors ${
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
                      className="flex h-10 w-10 items-center justify-center text-black/45 hover:text-black"
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
                      className="flex h-10 w-10 items-center justify-center text-black/45 hover:text-black"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                  <p className="text-[13px] text-black/40">
                    {stock <= 5 ? `Only ${stock} left` : "In stock"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  disabled
                  className="w-full border border-black/10 py-4 text-[13px] font-medium uppercase tracking-[0.16em] text-black/30"
                >
                  Select a vendor
                </button>
                <WishlistButton product={product} showToast={showToast} />
              </div>
            )}
          </div>
        </div>

        {/* Details / Reviews / Questions */}
        <section className="mt-24 lg:mt-32" id="reviews">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b border-black/[0.06] pb-6">
            <div className="flex gap-8 sm:gap-10">
              {(
                [
                  ["details", "Details"],
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
              {activeTab === "details"
                ? "Product information"
                : activeTab === "reviews"
                  ? "From verified shoppers"
                  : "Ask before you buy"}
            </p>
          </div>

          <div className="mt-12 max-w-4xl">
            {activeTab === "details" ? (
              <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
                <div className="lg:col-span-7">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                    About
                  </p>
                  <p className="mt-5 whitespace-pre-line text-[16px] leading-[1.8] text-black/60">
                    {product.longDescription || product.description}
                  </p>
                </div>

                <div className="lg:col-span-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                    At a glance
                  </p>
                  <dl className="mt-5">
                    {[
                      { label: "Category", value: product.category },
                      {
                        label: "Pickup",
                        value: "Click & collect from your chosen vendor",
                      },
                      {
                        label: "Sellers",
                        value:
                          availableOffers.length > 0
                            ? `${availableOffers.length} nearby`
                            : "None available",
                      },
                      {
                        label: "Availability",
                        value: selectedOffer
                          ? selectedOffer.stock > 0
                            ? "In stock"
                            : "Out of stock"
                          : "Select a vendor",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-baseline justify-between gap-6 border-b border-black/[0.06] py-4"
                      >
                        <dt className="text-[13px] text-black/35">{row.label}</dt>
                        <dd className="text-right text-[14px] font-medium tracking-tight text-black/80">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {availableOffers.length > 0 ? (
                    <div className="mt-10">
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                        Available from
                      </p>
                      <ul className="mt-4 space-y-3">
                        {availableOffers.map((offer) => (
                          <li key={offer.id}>
                            <Link
                              href={`/vendors/${resolveVendorSlug({
                                id: offer.vendorId,
                                name: offer.vendorName,
                              })}`}
                              className="group flex items-baseline justify-between gap-4 text-[14px]"
                            >
                              <span className="font-medium tracking-tight transition-opacity group-hover:opacity-50">
                                {offer.vendorName}
                              </span>
                              <span className="tabular-nums text-black/45">
                                {formatPrice(offer.price)}
                              </span>
                            </Link>
                            {offer.neighbourhood ? (
                              <p className="mt-0.5 text-[12px] text-black/35">
                                {offer.neighbourhood}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {activeTab === "reviews" ? <ProductReviews productId={product.id} /> : null}
            {activeTab === "questions" ? (
              <ProductQuestions productId={product.id} />
            ) : null}
          </div>
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
