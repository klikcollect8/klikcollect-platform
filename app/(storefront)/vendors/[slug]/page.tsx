"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ListFilter, Search } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/obscura/Reveal";
import {
  useVendorStore,
  type VendorBranch,
  type VendorHours,
} from "@/components/storefront/VendorStoreContext";
import VendorLiveStatus from "@/components/storefront/VendorLiveStatus";
import VendorLocationMap from "@/components/storefront/VendorLocationMap";
import ThemeSelect from "@/components/ui/ThemeSelect";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { computeLiveStoreStatus } from "@/lib/store-hours-live";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function hoursForLocation(
  loc: VendorBranch | undefined,
  hours: VendorHours[],
  fallback: VendorHours | null,
): VendorHours | null {
  if (!loc) return fallback;
  return hours.find((h) => h.storePublicId === loc.publicId) || fallback;
}

function directionsFor(loc: VendorBranch | null | undefined): string | null {
  if (!loc) return null;
  if (loc.lat != null && loc.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
  }
  const q = [loc.address, loc.neighbourhood].filter(Boolean).join(", ");
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : null;
}

function VendorStoreHomeInner() {
  const {
    vendor,
    products,
    categories,
    locations,
    hours,
    primaryHours,
    reviews,
    questions,
  } = useVendorStore();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);
  const [userLocId, setUserLocId] = useState<string | null>(null);
  const [mapShowAll, setMapShowAll] = useState(true);

  const category = categoryOverride ?? searchParams.get("c") ?? "all";
  const setCategory = (value: string) => setCategoryOverride(value);

  const activeLocId = useMemo(() => {
    if (!locations.length) return null;
    if (userLocId && locations.some((l) => l.publicId === userLocId)) {
      return userLocId;
    }
    return (locations.find((l) => l.isPrimary) || locations[0]).publicId;
  }, [locations, userLocId]);

  const filtered = useMemo(() => {
    let list =
      category === "all"
        ? products
        : products.filter((p) => p.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, category, query]);

  const activeLoc =
    locations.find((l) => l.publicId === activeLocId) ||
    locations.find((l) => l.isPrimary) ||
    locations[0] ||
    null;

  const activeHours = useMemo(
    () => hoursForLocation(activeLoc || undefined, hours, primaryHours),
    [activeLoc, hours, primaryHours],
  );

  const liveHours = useMemo(() => {
    if (!activeHours) return null;
    return { weekly: activeHours.weekly, holidays: activeHours.holidays };
  }, [activeHours]);

  const pins = useMemo(
    () =>
      locations
        .filter(
          (loc): loc is typeof loc & { lat: number; lng: number } =>
            loc.lat != null &&
            loc.lng != null &&
            Number.isFinite(loc.lat) &&
            Number.isFinite(loc.lng),
        )
        .map((loc) => ({
          id: loc.publicId,
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
        })),
    [locations],
  );

  const heroLive = computeLiveStoreStatus(liveHours);
  const nairobiDay = heroLive.dayOfWeek;

  if (!vendor) return null;

  const countLabel = `${filtered.length} ${filtered.length === 1 ? "item" : "items"}`;
  const showLocations = vendor.storefront.showLocations !== false;
  const showHours = vendor.storefront.showHours !== false;
  const showReviews = vendor.storefront.showReviews !== false;
  const reviewList = reviews?.reviews || [];
  const summary = reviews?.summary;
  const qaList = questions || [];
  const activeDirections = directionsFor(activeLoc);

  const selectLocation = (id: string) => {
    setUserLocId(id);
    setMapShowAll(false);
  };

  const answeredQs = qaList.filter((q) => (q.answers || []).length > 0).length;
  const metaBits = [
    summary && summary.count > 0
      ? `${summary.average.toFixed(1)} · ${summary.count}`
      : null,
    products.length ? `${products.length} items` : null,
    locations.length
      ? `${locations.length} ${locations.length === 1 ? "branch" : "branches"}`
      : null,
    qaList.length ? `${answeredQs}/${qaList.length} Q&A` : null,
  ].filter(Boolean) as string[];

  const sectionTabs = [
    { href: "#shop", label: "Shop" },
    showLocations || showHours ? { href: "#visit", label: "Visit" } : null,
    showReviews ? { href: "#reviews", label: "Reviews" } : null,
    showReviews ? { href: "#questions", label: "Q&A" } : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  const quickActions = [
    activeDirections
      ? { href: activeDirections, label: "Directions", external: true }
      : null,
    vendor.contactPhone
      ? { href: `tel:${vendor.contactPhone}`, label: "Call" }
      : null,
    vendor.contactEmail
      ? { href: `mailto:${vendor.contactEmail}`, label: "Email" }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    external?: boolean;
  }>;

  return (
    <div className="space-y-10 sm:space-y-20 lg:space-y-28">
      {/* Hero */}
      <header className="space-y-2 sm:space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <h1 className="max-w-4xl text-[clamp(2.25rem,9vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.04em]">
            {vendor.displayName || vendor.name}
          </h1>
          {/* Meta - desktop only; tucked away on mobile */}
          {metaBits.length ? (
            <div className="hidden flex-wrap justify-end gap-x-3 gap-y-1 text-[12px] tabular-nums text-black/45 sm:flex">
              {metaBits.map((bit) => (
                <span key={bit}>{bit}</span>
              ))}
            </div>
          ) : null}
        </div>

        {showHours ? (
          <div className="sm:border-y sm:border-black/[0.06] sm:py-4">
            <VendorLiveStatus
              hours={liveHours}
              variant="hero"
              label={
                activeLoc
                  ? activeLoc.neighbourhood || activeLoc.name
                  : undefined
              }
            />
          </div>
        ) : null}

        {/* Desktop section / action links only - mobile stays clean */}
        <div className="hidden items-center gap-3 sm:flex">
          <nav
            aria-label="Store sections"
            className="flex min-w-0 flex-1 gap-5"
          >
            {sectionTabs.map((tab) => (
              <a
                key={tab.href}
                href={tab.href}
                className="text-[12px] font-medium uppercase tracking-[0.14em] text-black/45 transition-colors hover:text-black"
              >
                {tab.label}
              </a>
            ))}
          </nav>
          {quickActions.length ? (
            <div className="flex shrink-0 gap-4">
              {quickActions.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.external
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                  className="text-[12px] uppercase tracking-[0.14em] text-black/40 underline-offset-4 hover:text-black hover:underline"
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      {/* Catalogue */}
      <section id="shop" className="scroll-mt-24">
        {/* Mobile: full-width search + filter icon */}
        <div className="mb-5 flex items-stretch gap-2 sm:hidden">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="box-border h-12 w-full border border-black/12 bg-transparent py-0 pl-10 pr-3 text-[16px] leading-none focus:border-black/40 focus:outline-none"
            />
      </div>
          {categories.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Filter by category"
                className={`relative inline-flex h-12 w-12 shrink-0 items-center justify-center border border-black/12 text-black/55 transition-colors hover:border-black/30 hover:text-black ${
                  category !== "all" ? "border-black/40 text-black" : ""
                }`}
              >
                <ListFilter className="h-4 w-4" />
                {category !== "all" ? (
                  <span
                    className="absolute right-2.5 top-2.5 h-1.5 w-1.5 bg-black"
                    aria-hidden
                  />
                ) : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]">
                <DropdownMenuRadioGroup
                  value={category}
                  onValueChange={setCategory}
                >
                  <DropdownMenuRadioItem value="all">
                    All categories
                  </DropdownMenuRadioItem>
          {categories.map((cat) => (
                    <DropdownMenuRadioItem key={cat.name} value={cat.name}>
                      {cat.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Desktop / tablet: search + category select */}
        <div
          className={`mb-10 hidden items-stretch gap-3 sm:grid ${
            categories.length > 0
              ? "sm:grid-cols-[minmax(0,1fr)_13rem]"
              : "sm:grid-cols-1"
          }`}
        >
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="box-border h-11 w-full border border-black/12 bg-transparent py-0 pl-11 pr-4 text-[14px] leading-none focus:border-black/40 focus:outline-none"
            />
          </div>
          {categories.length > 0 ? (
            <ThemeSelect
              value={category}
              onValueChange={setCategory}
              size="sm"
              fullWidth
              placeholder="All"
              triggerClassName="box-border h-11 w-full min-w-0 px-4 text-[14px] leading-none"
              className="min-w-[12rem]"
              options={[
                { value: "all", label: "All categories" },
                ...categories.map((cat) => ({
                  value: cat.name,
                  label: cat.name,
                })),
              ]}
            />
          ) : null}
        </div>

        <p className="mb-5 text-[11px] uppercase tracking-[0.14em] text-black/35 sm:mb-8 sm:text-[12px]">
          {countLabel}
          {category !== "all" ? ` · ${category}` : ""}
        </p>

        {filtered.length > 0 ? (
          <div className="border-t border-black/[0.06] pt-6 sm:pt-14">
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-14 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-8 xl:gap-y-16">
          {filtered.map((p) => (
            <ProductCard
              key={p.offerId || p.id}
              product={p}
              offerPrice={typeof p.price === "number" ? p.price : undefined}
              offerId={p.offerId}
            />
          ))}
            </div>
        </div>
      ) : (
          <div className="border-t border-black/[0.06] py-14 text-center sm:py-20">
            <p className="text-[17px] font-medium tracking-tight sm:text-[18px]">
              {products.length ? "No products match" : "Nothing listed yet"}
            </p>
            <p className="mt-2 text-[14px] text-black/50 sm:text-[15px]">
              {products.length
                ? "Try another search or category."
                : "Check back soon for new arrivals."}
            </p>
          </div>
        )}
      </section>

      {(showHours || showLocations) && (
        <Reveal>
          <section
            id="visit"
            className="scroll-mt-24 border-t border-black/[0.06] pt-8 sm:pt-20"
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-10 sm:gap-4">
              <h2 className="text-[clamp(1.25rem,4vw,2rem)] font-medium tracking-tight">
                Locations
              </h2>
              <div className="hidden flex-wrap items-center gap-3 sm:flex sm:gap-4">
                <p className="text-[13px] text-black/40">
                  {locations.length || 0}{" "}
                  {locations.length === 1 ? "branch" : "branches"}
                </p>
                {pins.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setMapShowAll(true)}
                    className="text-[13px] underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
                  >
                    Show all
                  </button>
                ) : null}
              </div>
            </div>

            {/* Mobile: quiet branch select (no Closed chips) */}
            {showLocations && locations.length > 1 ? (
              <div className="mb-4 max-w-xs sm:hidden">
                <ThemeSelect
                  value={activeLocId || ""}
                  onValueChange={selectLocation}
                  size="sm"
                  fullWidth
                  placeholder="Branch"
                  triggerClassName="h-10 border-0 border-b border-black/12 px-0 shadow-none"
                  options={locations.map((loc) => ({
                    value: loc.publicId,
                    label: loc.neighbourhood || loc.name,
                  }))}
                />
              </div>
            ) : null}

            {showLocations && pins.length > 0 ? (
              <div className="mb-5 overflow-hidden sm:mb-10 sm:border sm:border-black/[0.08]">
                <VendorLocationMap
                  pins={pins}
                  activeId={activeLocId}
                  showAll={mapShowAll}
                  onPinClick={selectLocation}
                  heightClassName="h-[180px] sm:h-[380px] lg:h-[440px]"
                />
              </div>
            ) : null}

            {/* Mobile: address + tucked hours */}
            {showLocations && activeLoc ? (
              <div className="mb-2 space-y-1.5 sm:hidden">
                <p className="text-[15px] font-medium tracking-tight">
                  {activeLoc.name}
                </p>
                <p className="text-[13px] leading-relaxed text-black/50">
                  {[activeLoc.address, activeLoc.neighbourhood]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[13px] text-black/45">
                  {activeDirections ? (
                    <a
                      href={activeDirections}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-[5px] decoration-black/20"
                    >
                      Directions
                    </a>
                  ) : null}
                  {activeLoc.phone ? (
                    <a
                      href={`tel:${activeLoc.phone}`}
                      className="underline underline-offset-[5px] decoration-black/20"
                    >
                      Call
                    </a>
                  ) : null}
                  {vendor.contactEmail ? (
                    <a
                      href={`mailto:${vendor.contactEmail}`}
                      className="underline underline-offset-[5px] decoration-black/20"
                    >
                      Email
                    </a>
                  ) : null}
                </div>
                {showHours && activeHours ? (
                  <details className="pt-3">
                    <summary className="cursor-pointer list-none text-[13px] text-black/40 marker:content-none [&::-webkit-details-marker]:hidden">
                      Hours
                      {heroLive.todayRange ? (
                        <span className="ml-2 text-black/30">
                          Today {heroLive.todayRange}
                        </span>
                      ) : null}
                    </summary>
                    <ul className="mt-3 space-y-2">
                      {activeHours.weekly.map((d) => {
                        const isToday = d.dayOfWeek === nairobiDay;
                        return (
                          <li
                            key={d.dayOfWeek}
                            className={`flex items-baseline justify-between gap-4 text-[13px] ${
                              isToday ? "text-black" : "text-black/45"
                            }`}
                          >
                            <span>{DAY_NAMES[d.dayOfWeek]}</span>
                            <span className="tabular-nums">
                              {d.isClosed
                                ? "Closed"
                                : `${d.openTime || " - "}-${d.closeTime || " - "}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
              <aside className="hidden lg:col-span-5 lg:block">
                {showHours && activeHours ? (
                  <div className="border border-black/[0.08] p-8 lg:sticky lg:top-8">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-black/35">
                      Hours
                    </p>
                    <p className="mt-3 text-[18px] font-medium tracking-tight">
                      {activeLoc?.name || activeHours.storeName}
                    </p>
                    {activeLoc?.neighbourhood ? (
                      <p className="mt-1 text-[13px] text-black/40">
                        {activeLoc.neighbourhood}
                      </p>
                    ) : null}
                    {activeDirections ? (
                      <a
                        href={activeDirections}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-[13px] underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
                      >
                        Directions →
                      </a>
                    ) : null}
                    <ul className="mt-8 space-y-3 border-t border-black/[0.06] pt-6">
                      {activeHours.weekly.map((d) => {
                        const isToday = d.dayOfWeek === nairobiDay;
                        return (
                          <li
                            key={d.dayOfWeek}
                            className={`flex items-baseline justify-between gap-4 text-[14px] ${
                              isToday
                                ? "font-medium text-black"
                                : "text-black/50"
                            }`}
                          >
                            <span>{DAY_NAMES[d.dayOfWeek]}</span>
                            <span className="tabular-nums text-black">
                              {d.isClosed
                                ? "Closed"
                                : `${d.openTime || " - "}-${d.closeTime || " - "}`}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : showHours ? (
                  <p className="text-[15px] text-black/45">
                    Opening times not published yet.
                  </p>
                ) : null}
              </aside>

              <div className="order-2 hidden lg:order-1 lg:col-span-7 lg:block">
                {showLocations && locations.length > 0 ? (
                  <div className="divide-y divide-black/[0.06] border-t border-black/[0.06]">
                    {locations.map((loc, index) => {
                      const locHours = hoursForLocation(
                        loc,
                        hours,
                        primaryHours,
                      );
                      const live = locHours
                        ? computeLiveStoreStatus({
                            weekly: locHours.weekly,
                            holidays: locHours.holidays,
                          })
                        : null;
                      const isActive = activeLocId === loc.publicId;
                      const maps = directionsFor(loc);
                      const addr = [loc.address, loc.neighbourhood]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <button
                          key={loc.publicId}
                          type="button"
                          onClick={() => selectLocation(loc.publicId)}
                          className={`group flex w-full flex-col gap-3 py-7 text-left transition-opacity sm:flex-row sm:items-start sm:justify-between sm:gap-8 ${
                            isActive
                              ? "opacity-100"
                              : "opacity-55 hover:opacity-100"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="text-[12px] tabular-nums text-black/30">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <p
                                className={`text-[17px] font-medium tracking-tight ${
                                  isActive ? "underline underline-offset-4" : ""
                                }`}
                              >
                                {loc.name}
                              </p>
                              {loc.isPrimary ? (
                                <span className="text-[11px] uppercase tracking-[0.14em] text-black/35">
                                  Primary
                                </span>
                              ) : null}
                            </div>
                            {addr ? (
                              <p className="mt-2 text-[14px] leading-relaxed text-black/50">
                                {addr}
                              </p>
                            ) : null}
                            {loc.phone ? (
                              <p className="mt-1 text-[13px] text-black/40">
                                {loc.phone}
                              </p>
                            ) : null}
                          </div>
                          <div className="shrink-0 sm:text-right">
                            {live ? (
                              <p
                                className={`text-[13px] font-medium uppercase tracking-[0.12em] ${
                                  live.openNow ? "text-black" : "text-black/35"
                                }`}
                              >
                                {live.statusLabel}
                              </p>
                            ) : null}
                            {maps ? (
                              <a
                                href={maps}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-block text-[13px] underline underline-offset-[6px] decoration-black/25 hover:decoration-black"
                              >
                                Directions →
                              </a>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : showLocations ? (
                  <p className="border-t border-black/[0.06] pt-8 text-[15px] text-black/45">
                    No public branches yet.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {showReviews ? (
        <Reveal>
          <section
            id="reviews"
            className="scroll-mt-24 border-t border-black/[0.06] pt-8 sm:pt-20"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-10 sm:gap-4">
              <div>
                <p className="mb-2 hidden text-[11px] font-medium uppercase tracking-[0.2em] text-black/35 sm:mb-3 sm:block">
                  Feedback
                </p>
                <h2 className="text-[clamp(1.35rem,5vw,2rem)] font-medium tracking-tight">
                  Reviews
                </h2>
              </div>
              {summary && summary.count > 0 ? (
                <div className="flex items-baseline gap-2.5 sm:gap-3">
                  <p className="text-[clamp(1.75rem,6vw,2.75rem)] font-medium tabular-nums tracking-tight">
                    {summary.average.toFixed(1)}
                  </p>
                  <p className="text-[12px] text-black/40 sm:text-[13px]">
                    {summary.count} {summary.count === 1 ? "review" : "reviews"}
                  </p>
                </div>
              ) : null}
            </div>

            {summary && summary.count > 0 ? (
              <div className="mb-6 grid grid-cols-5 gap-2 sm:mb-10 sm:gap-3">
                {summary.distribution.map((d) => {
                  const pct =
                    summary.count > 0
                      ? Math.round((d.count / summary.count) * 100)
                      : 0;
                  return (
                    <div
                      key={d.stars}
                      className="border-t border-black/[0.08] pt-2.5 sm:pt-3"
                    >
                      <p className="text-[11px] text-black/40 sm:text-[12px]">
                        {d.stars}★
                      </p>
                      <div className="mt-1.5 h-px bg-black/10 sm:mt-2">
                        <div
                          className="h-px bg-black"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] tabular-nums text-black/35 sm:mt-2 sm:text-[12px]">
                        {d.count}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {reviewList.length ? (
              <div className="divide-y divide-black/[0.06] border-t border-black/[0.06]">
                {reviewList.map((r) => (
                  <article
                    key={r.id}
                    className="grid gap-3 py-6 sm:grid-cols-12 sm:gap-10 sm:py-10"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 sm:col-span-4 sm:block">
                      <p className="text-[14px] font-medium sm:text-[15px]">
                        {r.userName}
                      </p>
                      <p className="text-[12px] tracking-[0.12em] text-black/40 sm:mt-2">
                        {"★".repeat(r.rating)}
                      </p>
                      <p className="w-full text-[10px] uppercase tracking-[0.14em] text-black/30 sm:mt-2 sm:text-[11px]">
                        {new Intl.DateTimeFormat("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(r.createdAt))}
                      </p>
                    </div>
                    <div className="sm:col-span-8">
                      {r.title ? (
                        <p className="text-[15px] font-medium tracking-tight sm:text-[16px]">
                          {r.title}
                        </p>
                      ) : null}
                      <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-black/50 sm:mt-2 sm:text-[15px]">
                        {r.comment}
                      </p>
                      <Link
                        href={`/products/${r.productId}`}
                        className="mt-2.5 inline-flex min-h-10 items-center text-[13px] text-black/40 underline underline-offset-[6px] decoration-black/20 hover:text-black hover:decoration-black sm:mt-3 sm:min-h-0"
                      >
                        {r.productName}
                      </Link>
                      {(r.answers || []).length > 0 ? (
                        <div className="mt-4 space-y-3 border-l border-black/10 pl-3 sm:mt-5 sm:pl-4">
                          {r.answers.map((a) => (
                            <div key={a.id}>
                              <p className="text-[10px] uppercase tracking-[0.14em] text-black/35 sm:text-[11px]">
                                {a.userName || "Store"}
                              </p>
                              <p className="mt-1 text-[13px] leading-relaxed text-black/55 sm:text-[14px]">
                                {a.answer}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="border-t border-black/[0.06] pt-6 text-[14px] text-black/45 sm:pt-8 sm:text-[15px]">
                No reviews yet.
              </p>
            )}
          </section>
        </Reveal>
      ) : null}

      {showReviews ? (
        <Reveal>
          <section
            id="questions"
            className="scroll-mt-24 border-t border-black/[0.06] pt-8 sm:pt-20"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-10 sm:gap-4">
              <div>
                <p className="mb-2 hidden text-[11px] font-medium uppercase tracking-[0.2em] text-black/35 sm:mb-3 sm:block">
                  Q&A
                </p>
                <h2 className="text-[clamp(1.35rem,5vw,2rem)] font-medium tracking-tight">
                  Questions
                </h2>
              </div>
              <p className="text-[12px] text-black/40 sm:text-[13px]">
                {qaList.length} {qaList.length === 1 ? "question" : "questions"}
              </p>
            </div>

            {qaList.length ? (
              <div className="divide-y divide-black/[0.06] border-t border-black/[0.06]">
                {qaList.map((q) => (
                  <article
                    key={q.id}
                    className="grid gap-3 py-6 sm:grid-cols-12 sm:gap-10 sm:py-10"
                  >
                    <div className="sm:col-span-4">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-black/35 sm:text-[11px]">
                        Asked by
                      </p>
                      <p className="mt-1.5 text-[14px] font-medium sm:mt-2 sm:text-[15px]">
                        {q.userName}
                      </p>
                      <Link
                        href={`/products/${q.productId}`}
                        className="mt-2 inline-flex min-h-10 items-center text-[13px] text-black/40 underline underline-offset-[6px] decoration-black/20 hover:text-black hover:decoration-black sm:mt-3 sm:min-h-0"
                      >
                        {q.productName}
                      </Link>
                    </div>
                    <div className="sm:col-span-8">
                      <p className="text-[16px] font-medium tracking-tight sm:text-[17px]">
                        {q.question}
                      </p>
                      {(q.answers || []).length > 0 ? (
                        <div className="mt-4 space-y-3 border-l border-black/10 pl-3 sm:mt-5 sm:space-y-4 sm:pl-4">
                          {q.answers.map((a) => (
                            <div key={a.id}>
                              <p className="text-[10px] uppercase tracking-[0.14em] text-black/35 sm:text-[11px]">
                                {a.userName || "Answer"}
                              </p>
                              <p className="mt-1 text-[14px] leading-relaxed text-black/55 sm:text-[15px]">
                                {a.answer}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-[12px] text-black/35 sm:mt-4 sm:text-[13px]">
                          Awaiting an answer
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="border-t border-black/[0.06] pt-6 text-[14px] text-black/45 sm:pt-8 sm:text-[15px]">
                No questions yet.
              </p>
            )}
          </section>
        </Reveal>
      ) : null}
    </div>
  );
}

export default function VendorStoreHomePage() {
  return (
    <Suspense fallback={null}>
      <VendorStoreHomeInner />
    </Suspense>
  );
}
