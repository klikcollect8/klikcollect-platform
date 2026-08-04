"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/NavIcons";
import {
  CURATION_MAX_EDITS,
  V1_CATEGORIES,
  type CurationApplication,
} from "@/lib/curation-policy";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useUserAuth } from "@/lib/hooks/useUserAuth";
import { pushCustomerNotification } from "@/lib/customer-notifications";
import { track } from "@/lib/track";

type SellApplicationPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  /** When set, panel updates this pending application (counts toward edit limit). */
  editApplication?: CurationApplication | null;
  /** Open the live tracking popup after submit/update. */
  onTrack?: () => void;
};

type Option = { value: string; label: string };

type FormState = {
  businessName: string;
  businessType: string;
  businessTypeOther: string;
  yearsOperating: string;
  yearsOperatingOther: string;
  teamSize: string;
  teamSizeOther: string;
  pitch: string;
  categories: string[];
  categoryOther: string;
  sourcing: string;
  sourcingOther: string;
  neighbourhood: string;
  city: string;
  storage: string;
  storageOther: string;
  fulfilment: string;
  fulfilmentOther: string;
  serviceAreas: string;
  leadTime: string;
  leadTimeOther: string;
  productCount: string;
  productCountOther: string;
  paymentMethods: string;
  paymentMethodsOther: string;
  returnsPolicy: string;
  returnsPolicyOther: string;
  packaging: string;
  packagingOther: string;
  peakSeason: string;
  peakSeasonOther: string;
  photographyReady: string;
  photographyOther: string;
  businessRegistered: string;
  registeredOther: string;
  inventorySystem: string;
  inventoryOther: string;
  standards: string;
  standardsOther: string;
  whyKlik: string;
  referralSource: string;
  referralSourceOther: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  instagram: string;
  tiktok: string;
  socialOther: string;
  availability: string;
  availabilityOther: string;
  notes: string;
};

const EMPTY: FormState = {
  businessName: "",
  businessType: "",
  businessTypeOther: "",
  yearsOperating: "",
  yearsOperatingOther: "",
  teamSize: "",
  teamSizeOther: "",
  pitch: "",
  categories: [],
  categoryOther: "",
  sourcing: "",
  sourcingOther: "",
  neighbourhood: "",
  city: "Nairobi",
  storage: "",
  storageOther: "",
  fulfilment: "",
  fulfilmentOther: "",
  serviceAreas: "",
  leadTime: "",
  leadTimeOther: "",
  productCount: "",
  productCountOther: "",
  paymentMethods: "",
  paymentMethodsOther: "",
  returnsPolicy: "",
  returnsPolicyOther: "",
  packaging: "",
  packagingOther: "",
  peakSeason: "",
  peakSeasonOther: "",
  photographyReady: "",
  photographyOther: "",
  businessRegistered: "",
  registeredOther: "",
  inventorySystem: "",
  inventoryOther: "",
  standards: "",
  standardsOther: "",
  whyKlik: "",
  referralSource: "",
  referralSourceOther: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  website: "",
  instagram: "",
  tiktok: "",
  socialOther: "",
  availability: "",
  availabilityOther: "",
  notes: "",
};

function formFromApplication(app: CurationApplication): FormState {
  const d = app.details || {};
  const categoryOther = d.categoryOther || "";
  const known = new Set<string>(V1_CATEGORIES as readonly string[]);
  const cats = app.categories.filter((c) => known.has(c));
  const categories =
    categoryOther || app.categories.some((c) => !known.has(c))
      ? [...cats.slice(0, 3), "other"]
      : cats.slice(0, 3);

  return {
    ...EMPTY,
    businessName: app.businessName || "",
    businessType: d.businessType || "",
    businessTypeOther: d.businessTypeOther || "",
    yearsOperating: d.yearsOperating || "",
    yearsOperatingOther: d.yearsOperatingOther || "",
    teamSize: d.teamSize || "",
    teamSizeOther: d.teamSizeOther || "",
    pitch: d.pitch || "",
    categories,
    categoryOther:
      categoryOther ||
      app.categories.find((c) => !known.has(c)) ||
      "",
    sourcing: d.sourcing || "",
    sourcingOther: d.sourcingOther || "",
    neighbourhood: app.neighbourhood || "",
    city: d.city || "Nairobi",
    storage: d.storage || "",
    storageOther: d.storageOther || "",
    fulfilment: d.fulfilment || "",
    fulfilmentOther: d.fulfilmentOther || "",
    serviceAreas: d.serviceAreas || "",
    leadTime: d.leadTime || "",
    leadTimeOther: d.leadTimeOther || "",
    productCount: d.productCount || "",
    productCountOther: d.productCountOther || "",
    paymentMethods: d.paymentMethods || "",
    paymentMethodsOther: d.paymentMethodsOther || "",
    returnsPolicy: d.returnsPolicy || "",
    returnsPolicyOther: d.returnsPolicyOther || "",
    packaging: d.packaging || "",
    packagingOther: d.packagingOther || "",
    peakSeason: d.peakSeason || "",
    peakSeasonOther: d.peakSeasonOther || "",
    photographyReady: d.photographyReady || "",
    photographyOther: d.photographyOther || "",
    businessRegistered: d.businessRegistered || "",
    registeredOther: d.registeredOther || "",
    inventorySystem: d.inventorySystem || "",
    inventoryOther: d.inventoryOther || "",
    standards: d.standards || "",
    standardsOther: d.standardsOther || "",
    whyKlik: d.whyKlik || "",
    referralSource: d.referralSource || "",
    referralSourceOther: d.referralSourceOther || "",
    contactName: d.contactName || "",
    contactEmail: app.contactEmail || "",
    contactPhone: app.contactPhone || "",
    website: d.website || "",
    instagram: d.instagram || "",
    tiktok: d.tiktok || "",
    socialOther: d.socialOther || "",
    availability: d.availability || "",
    availabilityOther: d.availabilityOther || "",
    notes: "",
  };
}

const BUSINESS_TYPES: Option[] = [
  { value: "sole", label: "Sole proprietor" },
  { value: "ltd", label: "Limited company" },
  { value: "partnership", label: "Partnership" },
  { value: "informal", label: "Informal / not registered yet" },
  { value: "other", label: "Other" },
];

const YEARS: Option[] = [
  { value: "under_1", label: "Less than 1 year" },
  { value: "1_3", label: "1-3 years" },
  { value: "3_5", label: "3-5 years" },
  { value: "5_plus", label: "5+ years" },
  { value: "other", label: "Other" },
];

const STORAGE: Option[] = [
  { value: "dry", label: "Dry goods only" },
  { value: "cold", label: "Cold chain / refrigeration" },
  { value: "both", label: "Dry and cold" },
  { value: "fresh", label: "Fresh produce handling" },
  { value: "other", label: "Other" },
];

const FULFILMENT: Option[] = [
  { value: "pickup", label: "Customer pickup" },
  { value: "courier", label: "Courier / delivery" },
  { value: "both", label: "Both pickup and delivery" },
  { value: "other", label: "Other" },
];

const LEAD_TIMES: Option[] = [
  { value: "same_day", label: "Same day" },
  { value: "1_2_days", label: "1-2 days" },
  { value: "3_5_days", label: "3-5 days" },
  { value: "1_week_plus", label: "A week or more" },
  { value: "other", label: "Other" },
];

const PRODUCT_COUNTS: Option[] = [
  { value: "1_10", label: "1-10 products" },
  { value: "11_50", label: "11-50" },
  { value: "51_200", label: "51-200" },
  { value: "200_plus", label: "200+" },
  { value: "other", label: "Other" },
];

const YES_NO: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "in_progress", label: "In progress" },
  { value: "no", label: "Not yet" },
  { value: "other", label: "Other" },
];

const INVENTORY: Option[] = [
  { value: "pos", label: "POS / inventory software" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "manual", label: "Manual / paper" },
  { value: "none", label: "No system yet" },
  { value: "other", label: "Other" },
];

const AVAILABILITY: Option[] = [
  { value: "weekdays", label: "Weekdays" },
  { value: "everyday", label: "Every day" },
  { value: "weekends", label: "Weekends mainly" },
  { value: "by_order", label: "By order / flexible" },
  { value: "other", label: "Other" },
];

const TEAM_SIZE: Option[] = [
  { value: "solo", label: "Solo" },
  { value: "2_5", label: "2-5" },
  { value: "6_20", label: "6-20" },
  { value: "20_plus", label: "20+" },
  { value: "other", label: "Other" },
];

const SOURCING: Option[] = [
  { value: "own_brand", label: "Own brand" },
  { value: "local_wholesale", label: "Local wholesale" },
  { value: "farm_producer", label: "Farm/producer" },
  { value: "imported", label: "Imported" },
  { value: "mix", label: "Mix" },
  { value: "other", label: "Other" },
];

const PAYMENT_METHODS: Option[] = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "card", label: "Card" },
  { value: "cod", label: "Cash on delivery" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mix", label: "Mix" },
  { value: "other", label: "Other" },
];

const RETURNS_POLICY: Option[] = [
  { value: "full_refunds", label: "Full refunds" },
  { value: "exchanges_only", label: "Exchanges only" },
  { value: "case_by_case", label: "Case by case" },
  { value: "no_returns", label: "No returns yet" },
  { value: "other", label: "Other" },
];

const PACKAGING: Option[] = [
  { value: "branded", label: "Branded packaging ready" },
  { value: "plain", label: "Plain packaging" },
  { value: "need_help", label: "Need help" },
  { value: "other", label: "Other" },
];

const PEAK_SEASON: Option[] = [
  { value: "year_round", label: "Year-round steady" },
  { value: "seasonal", label: "Strong seasonal peaks" },
  { value: "just_starting", label: "Just starting" },
  { value: "other", label: "Other" },
];

const REFERRAL_SOURCE: Option[] = [
  { value: "friend_vendor", label: "Friend/vendor" },
  { value: "social", label: "Social" },
  { value: "search", label: "Search" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

const STANDARDS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "need_clarity", label: "Need clarity" },
  { value: "other", label: "Other" },
];

const field =
  "w-full border-0 border-b border-black/15 bg-transparent px-0 py-4 text-[clamp(1.15rem,2.6vw,1.5rem)] font-medium tracking-tight text-black outline-none transition-colors placeholder:font-normal placeholder:text-black/30 focus:border-black/50";

type StepId =
  | "welcome"
  | "business"
  | "businessType"
  | "years"
  | "teamSize"
  | "pitch"
  | "categories"
  | "sourcing"
  | "location"
  | "storage"
  | "fulfilment"
  | "serviceAreas"
  | "capacity"
  | "paymentMethods"
  | "returnsPolicy"
  | "packaging"
  | "peakSeason"
  | "quality"
  | "standards"
  | "inventory"
  | "availability"
  | "whyKlik"
  | "referralSource"
  | "contact"
  | "presence"
  | "notes"
  | "review"
  | "done";

const FLOW: StepId[] = [
  "welcome",
  "business",
  "businessType",
  "years",
  "teamSize",
  "pitch",
  "categories",
  "sourcing",
  "location",
  "storage",
  "fulfilment",
  "serviceAreas",
  "capacity",
  "paymentMethods",
  "returnsPolicy",
  "packaging",
  "peakSeason",
  "quality",
  "standards",
  "inventory",
  "availability",
  "whyKlik",
  "referralSource",
  "contact",
  "presence",
  "notes",
  "review",
  "done",
];

function labelOf(options: Option[], value: string, otherText?: string) {
  if (value === "other") {
    return otherText?.trim() ? `Other: ${otherText.trim()}` : "Other";
  }
  return options.find((o) => o.value === value)?.label || value || "-";
}

function ChoiceList({
  options,
  value,
  onChange,
  otherValue,
  onOtherChange,
  otherPlaceholder = "Please describe",
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  otherValue?: string;
  onOtherChange?: (v: string) => void;
  otherPlaceholder?: string;
}) {
  return (
    <div className="mt-8 border-t border-black/[0.06]">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <div key={opt.value}>
            <button
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex w-full min-h-14 items-center justify-between border-b border-black/[0.06] py-4 text-left text-[15px] transition-opacity hover:opacity-70 sm:text-[16px] ${
                active ? "text-black" : "text-black/50"
              }`}
            >
              <span>{opt.label}</span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-black/30">
                {active ? "Selected" : "Select"}
              </span>
            </button>
            {opt.value === "other" && active && onOtherChange ? (
              <input
                value={otherValue || ""}
                onChange={(e) => onOtherChange(e.target.value)}
                placeholder={otherPlaceholder}
                className={`${field} mb-2`}
                autoFocus
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function SellApplicationPanel({
  isOpen,
  onClose,
  editApplication = null,
  onTrack,
}: SellApplicationPanelProps) {
  const mounted = useIsClient();
  const { user, isSignedIn } = useUserAuth();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<StepId>("welcome");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refId, setRefId] = useState<string | null>(null);
  const isEdit = Boolean(editApplication?.id);
  const editsLeft = editApplication
    ? Math.max(0, CURATION_MAX_EDITS - (editApplication.editCount || 0))
    : CURATION_MAX_EDITS;

  const stepIndex = FLOW.indexOf(step);
  const progressSteps = FLOW.filter((s) => s !== "welcome" && s !== "done");
  const progressIndex = Math.max(
    0,
    progressSteps.indexOf(step as (typeof progressSteps)[number]),
  );
  const showProgress = step !== "welcome" && step !== "done";

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setStep("welcome");
        setForm(EMPTY);
        setError("");
        setBusy(false);
        setRefId(null);
      }, 280);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }

    if (editApplication) {
      setForm(formFromApplication(editApplication));
      setStep("business");
      setRefId(editApplication.id);
    } else {
      setForm({
        ...EMPTY,
        contactEmail: user?.email || "",
        contactName: user?.fullName || user?.firstName || "",
      });
      setStep("welcome");
      setRefId(null);
    }
    setError("");

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsVisible(true));
    });
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
  }, [isOpen, editApplication, user?.email, user?.fullName, user?.firstName]);

  useEffect(() => {
    if (!isOpen || !user?.email) return;
    setForm((prev) =>
      prev.contactEmail ? prev : { ...prev, contactEmail: user.email || "" },
    );
  }, [isOpen, user?.email]);

  useEffect(() => {
    if (!isOpen || !isVisible) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isOpen, isVisible, step]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleClose]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const toggleCategory = (c: string) => {
    setForm((prev) => {
      const on = prev.categories.includes(c);
      let categories = on
        ? prev.categories.filter((x) => x !== c)
        : [...prev.categories, c];
      const hasOther = categories.includes("other");
      const normals = categories.filter((x) => x !== "other");
      if (normals.length > 3) normals.length = 3;
      categories = hasOther ? [...normals, "other"] : normals;
      return {
        ...prev,
        categories,
        categoryOther: hasOther ? prev.categoryOther : "",
      };
    });
    setError("");
  };

  const selectionOk = (value: string, other: string) =>
    Boolean(value) && (value !== "other" || other.trim().length >= 2);

  const canContinue = useMemo(() => {
    switch (step) {
      case "welcome":
        return true;
      case "business":
        return form.businessName.trim().length >= 2;
      case "businessType":
        return selectionOk(form.businessType, form.businessTypeOther);
      case "years":
        return selectionOk(form.yearsOperating, form.yearsOperatingOther);
      case "teamSize":
        return selectionOk(form.teamSize, form.teamSizeOther);
      case "pitch":
        return form.pitch.trim().length >= 20;
      case "categories": {
        const hasCat = form.categories.some((c) => c !== "other");
        const otherOk =
          !form.categories.includes("other") ||
          form.categoryOther.trim().length >= 2;
        return (hasCat || form.categories.includes("other")) && otherOk;
      }
      case "sourcing":
        return selectionOk(form.sourcing, form.sourcingOther);
      case "location":
        return form.neighbourhood.trim().length >= 2;
      case "storage":
        return selectionOk(form.storage, form.storageOther);
      case "fulfilment":
        return selectionOk(form.fulfilment, form.fulfilmentOther);
      case "serviceAreas":
        return form.serviceAreas.trim().length >= 3;
      case "capacity":
        return (
          selectionOk(form.leadTime, form.leadTimeOther) &&
          selectionOk(form.productCount, form.productCountOther)
        );
      case "paymentMethods":
        return selectionOk(form.paymentMethods, form.paymentMethodsOther);
      case "returnsPolicy":
        return selectionOk(form.returnsPolicy, form.returnsPolicyOther);
      case "packaging":
        return selectionOk(form.packaging, form.packagingOther);
      case "peakSeason":
        return selectionOk(form.peakSeason, form.peakSeasonOther);
      case "quality":
        return (
          selectionOk(form.photographyReady, form.photographyOther) &&
          selectionOk(form.businessRegistered, form.registeredOther)
        );
      case "standards":
        return selectionOk(form.standards, form.standardsOther);
      case "inventory":
        return selectionOk(form.inventorySystem, form.inventoryOther);
      case "availability":
        return selectionOk(form.availability, form.availabilityOther);
      case "whyKlik":
        return form.whyKlik.trim().length >= 15;
      case "referralSource":
        return selectionOk(form.referralSource, form.referralSourceOther);
      case "contact":
        return (
          form.contactName.trim().length >= 2 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())
        );
      case "presence":
      case "notes":
      case "review":
        return true;
      default:
        return false;
    }
  }, [step, form]);

  const goNext = () => {
    if (!canContinue) {
      setError(
        "Please complete this step to continue. If you chose Other, add a short description.",
      );
      return;
    }
    const next = FLOW[stepIndex + 1];
    if (next) {
      setError("");
      setStep(next);
    }
  };

  const goBack = () => {
    setError("");
    const prev = FLOW[stepIndex - 1];
    if (prev && prev !== "done") setStep(prev);
  };

  async function submit() {
    setBusy(true);
    setError("");
    try {
      track(
        "vendor.apply_submitted",
        { businessName: form.businessName },
        "vendor",
      );

      const categories = form.categories
        .filter((c) => c !== "other")
        .concat(
          form.categories.includes("other") && form.categoryOther.trim()
            ? [form.categoryOther.trim()]
            : [],
        );

      const details = {
        pitch: form.pitch.trim(),
        city: form.city.trim(),
        businessType: form.businessType,
        businessTypeOther: form.businessTypeOther.trim() || undefined,
        yearsOperating: form.yearsOperating,
        yearsOperatingOther: form.yearsOperatingOther.trim() || undefined,
        teamSize: form.teamSize,
        teamSizeOther: form.teamSizeOther.trim() || undefined,
        categoryOther: form.categoryOther.trim() || undefined,
        sourcing: form.sourcing,
        sourcingOther: form.sourcingOther.trim() || undefined,
        storage: form.storage,
        storageOther: form.storageOther.trim() || undefined,
        fulfilment: form.fulfilment,
        fulfilmentOther: form.fulfilmentOther.trim() || undefined,
        serviceAreas: form.serviceAreas.trim(),
        leadTime: form.leadTime,
        leadTimeOther: form.leadTimeOther.trim() || undefined,
        productCount: form.productCount,
        productCountOther: form.productCountOther.trim() || undefined,
        paymentMethods: form.paymentMethods,
        paymentMethodsOther: form.paymentMethodsOther.trim() || undefined,
        returnsPolicy: form.returnsPolicy,
        returnsPolicyOther: form.returnsPolicyOther.trim() || undefined,
        packaging: form.packaging,
        packagingOther: form.packagingOther.trim() || undefined,
        peakSeason: form.peakSeason,
        peakSeasonOther: form.peakSeasonOther.trim() || undefined,
        photographyReady: form.photographyReady,
        photographyOther: form.photographyOther.trim() || undefined,
        businessRegistered: form.businessRegistered,
        registeredOther: form.registeredOther.trim() || undefined,
        inventorySystem: form.inventorySystem,
        inventoryOther: form.inventoryOther.trim() || undefined,
        standards: form.standards,
        standardsOther: form.standardsOther.trim() || undefined,
        whyKlik: form.whyKlik.trim(),
        referralSource: form.referralSource,
        referralSourceOther: form.referralSourceOther.trim() || undefined,
        website: form.website.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        tiktok: form.tiktok.trim() || undefined,
        socialOther: form.socialOther.trim() || undefined,
        availability: form.availability,
        availabilityOther: form.availabilityOther.trim() || undefined,
        contactName: form.contactName.trim(),
      };

      const notesParts = [
        form.pitch.trim(),
        form.notes.trim() ? `Extra: ${form.notes.trim()}` : "",
        `Type: ${labelOf(BUSINESS_TYPES, form.businessType, form.businessTypeOther)}`,
        `Years: ${labelOf(YEARS, form.yearsOperating, form.yearsOperatingOther)}`,
        `Team: ${labelOf(TEAM_SIZE, form.teamSize, form.teamSizeOther)}`,
        `Storage: ${labelOf(STORAGE, form.storage, form.storageOther)}`,
        `Fulfilment: ${labelOf(FULFILMENT, form.fulfilment, form.fulfilmentOther)}`,
        `Service areas: ${form.serviceAreas.trim()}`,
        `Lead time: ${labelOf(LEAD_TIMES, form.leadTime, form.leadTimeOther)}`,
        `Catalogue: ${labelOf(PRODUCT_COUNTS, form.productCount, form.productCountOther)}`,
        `Sourcing: ${labelOf(SOURCING, form.sourcing, form.sourcingOther)}`,
        `Payments: ${labelOf(PAYMENT_METHODS, form.paymentMethods, form.paymentMethodsOther)}`,
        `Returns: ${labelOf(RETURNS_POLICY, form.returnsPolicy, form.returnsPolicyOther)}`,
        `Packaging: ${labelOf(PACKAGING, form.packaging, form.packagingOther)}`,
        `Peak season: ${labelOf(PEAK_SEASON, form.peakSeason, form.peakSeasonOther)}`,
        `Photography: ${labelOf(YES_NO, form.photographyReady, form.photographyOther)}`,
        `Registered: ${labelOf(YES_NO, form.businessRegistered, form.registeredOther)}`,
        `Inventory: ${labelOf(INVENTORY, form.inventorySystem, form.inventoryOther)}`,
        `Standards: ${labelOf(STANDARDS, form.standards, form.standardsOther)}`,
        `Availability: ${labelOf(AVAILABILITY, form.availability, form.availabilityOther)}`,
        `Why KlikCollect: ${form.whyKlik.trim()}`,
        `Referral: ${labelOf(REFERRAL_SOURCE, form.referralSource, form.referralSourceOther)}`,
        form.website.trim() ? `Website: ${form.website.trim()}` : "",
        form.instagram.trim() ? `Instagram: ${form.instagram.trim()}` : "",
        form.tiktok.trim() ? `TikTok: ${form.tiktok.trim()}` : "",
        form.socialOther.trim()
          ? `Other social: ${form.socialOther.trim()}`
          : "",
        `Contact: ${form.contactName.trim()}`,
      ].filter(Boolean);

      const payload = {
        businessName: form.businessName.trim(),
        neighbourhood: form.neighbourhood.trim(),
        contactEmail: (user?.email || form.contactEmail).trim(),
        contactPhone: form.contactPhone.trim(),
        categories,
        notes: notesParts.join("\n"),
        details,
      };

      const res = await fetch(
        isEdit ? "/api/curation/mine" : "/api/curation",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit ? { id: editApplication!.id, ...payload } : payload,
          ),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "Could not submit");
        return;
      }
      const saved = json.data as CurationApplication;
      setRefId(saved.id);
      pushCustomerNotification({
        id: isEdit
          ? `sell-edit-${saved.id}-${saved.editCount}`
          : `sell-submit-${saved.id}`,
        title: isEdit
          ? "Sell application updated"
          : "Sell application received",
        body: isEdit
          ? `${saved.businessName} was updated (${saved.editCount} of ${CURATION_MAX_EDITS} edits used).`
          : `${saved.businessName} is in review. Track progress anytime.`,
        href: "/account/sell-application",
      });
      track(
        isEdit ? "sell.application_edited" : "sell.application_submitted",
        { applicationId: saved.id },
        "vendor",
      );
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !isOpen || typeof document === "undefined") return null;

  const heading = (title: string, sub: string) => (
    <>
      <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-medium tracking-tight">
        {title}
      </h2>
      <p className="mt-3 text-[14px] text-black/45">{sub}</p>
    </>
  );

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sell application"
      className={`fixed inset-0 z-[9999] bg-[#f7f7f5]/78 backdrop-blur-xl transition-opacity duration-300 ease-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative mx-auto flex h-full w-full max-w-[720px] flex-col px-5 sm:px-8">
        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
            {step === "done"
              ? isEdit
                ? "Updated"
                : "Submitted"
              : isEdit
                ? `Edit application · ${editsLeft} left`
                : "Apply to sell"}
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

        {showProgress ? (
          <div className="mt-5 shrink-0">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-black/35">
              <span>
                Step {progressIndex + 1} of {progressSteps.length}
              </span>
              <span>
                {Math.round(((progressIndex + 1) / progressSteps.length) * 100)}
                %
              </span>
            </div>
            <div className="mt-2 h-px bg-black/10">
              <div
                className="h-px bg-black transition-all duration-500 ease-out"
                style={{
                  width: `${((progressIndex + 1) / progressSteps.length) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          className={`scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-6 pt-10 transition-all duration-500 ease-out sm:pt-14 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {step === "welcome" ? (
            <div className="flex min-h-[50vh] flex-col justify-center">
              <h2 className="text-[clamp(1.85rem,5vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em]">
                Tell us about your shop.
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-black/50 sm:text-[16px]">
                One question per screen. Where you see Other, you can type your
                own answer. About 10-12 minutes.
              </p>
            </div>
          ) : null}

          {step === "business" ? (
            <div>
              {heading(
                "What's your business called?",
                "The name customers will see on KlikCollect.",
              )}
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                placeholder="Business name"
                className={`${field} mt-10`}
                autoComplete="organization"
              />
            </div>
          ) : null}

          {step === "businessType" ? (
            <div>
              {heading(
                "What kind of business is it?",
                "Helps us understand how you're set up.",
              )}
              <ChoiceList
                options={BUSINESS_TYPES}
                value={form.businessType}
                onChange={(v) => set("businessType", v)}
                otherValue={form.businessTypeOther}
                onOtherChange={(v) => set("businessTypeOther", v)}
                otherPlaceholder="Describe your business type"
              />
            </div>
          ) : null}

          {step === "years" ? (
            <div>
              {heading(
                "How long have you been operating?",
                "Experience helps us gauge readiness.",
              )}
              <ChoiceList
                options={YEARS}
                value={form.yearsOperating}
                onChange={(v) => set("yearsOperating", v)}
                otherValue={form.yearsOperatingOther}
                onOtherChange={(v) => set("yearsOperatingOther", v)}
                otherPlaceholder="e.g. Just launching / 8 years"
              />
            </div>
          ) : null}

          {step === "teamSize" ? (
            <div>
              {heading(
                "How big is your team?",
                "Helps us understand who handles orders and fulfilment.",
              )}
              <ChoiceList
                options={TEAM_SIZE}
                value={form.teamSize}
                onChange={(v) => set("teamSize", v)}
                otherValue={form.teamSizeOther}
                onOtherChange={(v) => set("teamSizeOther", v)}
                otherPlaceholder="Describe your team size"
              />
            </div>
          ) : null}

          {step === "pitch" ? (
            <div>
              {heading(
                "What do you sell?",
                "A short pitch about your assortment and who you serve.",
              )}
              <textarea
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.pitch}
                onChange={(e) => set("pitch", e.target.value)}
                rows={5}
                placeholder="e.g. Fresh dairy and pantry staples from Westlands..."
                className={`${field} mt-10 resize-none`}
              />
              <p className="mt-3 text-[12px] text-black/35">
                {form.pitch.trim().length}/20 characters minimum
              </p>
            </div>
          ) : null}

          {step === "categories" ? (
            <div>
              {heading(
                "Which categories fit best?",
                "Choose up to three, or add your own under Other.",
              )}
              <div className="mt-8 max-h-[42vh] divide-y divide-black/[0.06] overflow-y-auto border-y border-black/[0.06] scrollbar-hide">
                {[...V1_CATEGORIES, "other"].map((c) => {
                  const on = form.categories.includes(c);
                  const label = c === "other" ? "Other" : c;
                  return (
                    <div key={c}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(c)}
                        className={`flex w-full min-h-12 items-center justify-between py-3 text-left text-[15px] transition-opacity hover:opacity-70 ${
                          on ? "text-black" : "text-black/50"
                        }`}
                      >
                        <span>{label}</span>
                        <span className="text-[11px] uppercase tracking-[0.14em] text-black/30">
                          {on ? "Selected" : "Select"}
                        </span>
                      </button>
                      {c === "other" && on ? (
                        <input
                          value={form.categoryOther}
                          onChange={(e) => set("categoryOther", e.target.value)}
                          placeholder="Your category"
                          className={`${field} mb-2`}
                          autoFocus
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === "sourcing" ? (
            <div>
              {heading(
                "Where do your products come from?",
                "How you source stock today.",
              )}
              <ChoiceList
                options={SOURCING}
                value={form.sourcing}
                onChange={(v) => set("sourcing", v)}
                otherValue={form.sourcingOther}
                onOtherChange={(v) => set("sourcingOther", v)}
                otherPlaceholder="Describe your sourcing"
              />
            </div>
          ) : null}

          {step === "location" ? (
            <div>
              {heading(
                "Where do you operate from?",
                "Neighbourhood helps us plan logistics.",
              )}
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.neighbourhood}
                onChange={(e) => set("neighbourhood", e.target.value)}
                placeholder="Neighbourhood"
                className={`${field} mt-10`}
              />
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="City"
                className={`${field} mt-6`}
              />
            </div>
          ) : null}

          {step === "storage" ? (
            <div>
              {heading(
                "How do you store products?",
                "Especially important for fresh and chilled goods.",
              )}
              <ChoiceList
                options={STORAGE}
                value={form.storage}
                onChange={(v) => set("storage", v)}
                otherValue={form.storageOther}
                onOtherChange={(v) => set("storageOther", v)}
                otherPlaceholder="Describe your storage setup"
              />
            </div>
          ) : null}

          {step === "fulfilment" ? (
            <div>
              {heading(
                "How will you fulfil orders?",
                "Pick what matches how you work today.",
              )}
              <ChoiceList
                options={FULFILMENT}
                value={form.fulfilment}
                onChange={(v) => set("fulfilment", v)}
                otherValue={form.fulfilmentOther}
                onOtherChange={(v) => set("fulfilmentOther", v)}
                otherPlaceholder="Describe your fulfilment model"
              />
            </div>
          ) : null}

          {step === "serviceAreas" ? (
            <div>
              {heading(
                "Which areas can you serve?",
                "List neighbourhoods or zones you can reach.",
              )}
              <textarea
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.serviceAreas}
                onChange={(e) => set("serviceAreas", e.target.value)}
                rows={4}
                placeholder="e.g. Westlands, Parklands, Kilimani"
                className={`${field} mt-10 resize-none`}
              />
            </div>
          ) : null}

          {step === "capacity" ? (
            <div>
              {heading(
                "Capacity and timing",
                "Typical prep time and how many products you can list.",
              )}
              <p className="mt-10 text-[12px] uppercase tracking-[0.16em] text-black/40">
                Lead time
              </p>
              <ChoiceList
                options={LEAD_TIMES}
                value={form.leadTime}
                onChange={(v) => set("leadTime", v)}
                otherValue={form.leadTimeOther}
                onOtherChange={(v) => set("leadTimeOther", v)}
                otherPlaceholder="Your typical lead time"
              />
              <p className="mt-10 text-[12px] uppercase tracking-[0.16em] text-black/40">
                Products ready to list
              </p>
              <ChoiceList
                options={PRODUCT_COUNTS}
                value={form.productCount}
                onChange={(v) => set("productCount", v)}
                otherValue={form.productCountOther}
                onOtherChange={(v) => set("productCountOther", v)}
                otherPlaceholder="Approximate number of products"
              />
            </div>
          ) : null}

          {step === "paymentMethods" ? (
            <div>
              {heading(
                "How do customers pay you today?",
                "Pick what you already accept or plan to offer.",
              )}
              <ChoiceList
                options={PAYMENT_METHODS}
                value={form.paymentMethods}
                onChange={(v) => set("paymentMethods", v)}
                otherValue={form.paymentMethodsOther}
                onOtherChange={(v) => set("paymentMethodsOther", v)}
                otherPlaceholder="Describe your payment options"
              />
            </div>
          ) : null}

          {step === "returnsPolicy" ? (
            <div>
              {heading(
                "What is your returns policy?",
                "Honest answers help us set expectations with buyers.",
              )}
              <ChoiceList
                options={RETURNS_POLICY}
                value={form.returnsPolicy}
                onChange={(v) => set("returnsPolicy", v)}
                otherValue={form.returnsPolicyOther}
                onOtherChange={(v) => set("returnsPolicyOther", v)}
                otherPlaceholder="Describe your returns approach"
              />
            </div>
          ) : null}

          {step === "packaging" ? (
            <div>
              {heading(
                "How ready is your packaging?",
                "Branded or plain is fine. We can advise if needed.",
              )}
              <ChoiceList
                options={PACKAGING}
                value={form.packaging}
                onChange={(v) => set("packaging", v)}
                otherValue={form.packagingOther}
                onOtherChange={(v) => set("packagingOther", v)}
                otherPlaceholder="Describe your packaging setup"
              />
            </div>
          ) : null}

          {step === "peakSeason" ? (
            <div>
              {heading(
                "How steady is demand through the year?",
                "Helps us plan onboarding and support.",
              )}
              <ChoiceList
                options={PEAK_SEASON}
                value={form.peakSeason}
                onChange={(v) => set("peakSeason", v)}
                otherValue={form.peakSeasonOther}
                onOtherChange={(v) => set("peakSeasonOther", v)}
                otherPlaceholder="Describe your demand pattern"
              />
            </div>
          ) : null}

          {step === "quality" ? (
            <div>
              {heading(
                "Presentation and legitimacy",
                "Honest answers help us review faster.",
              )}
              <p className="mt-10 text-[12px] uppercase tracking-[0.16em] text-black/40">
                Product photography ready?
              </p>
              <ChoiceList
                options={YES_NO}
                value={form.photographyReady}
                onChange={(v) => set("photographyReady", v)}
                otherValue={form.photographyOther}
                onOtherChange={(v) => set("photographyOther", v)}
                otherPlaceholder="Tell us about your photos"
              />
              <p className="mt-10 text-[12px] uppercase tracking-[0.16em] text-black/40">
                Registered business?
              </p>
              <ChoiceList
                options={YES_NO}
                value={form.businessRegistered}
                onChange={(v) => set("businessRegistered", v)}
                otherValue={form.registeredOther}
                onOtherChange={(v) => set("registeredOther", v)}
                otherPlaceholder="Registration details or status"
              />
            </div>
          ) : null}

          {step === "standards" ? (
            <div>
              {heading(
                "Can you meet our seller standards?",
                "Quality products, honest listings, and reliable fulfilment.",
              )}
              <ChoiceList
                options={STANDARDS}
                value={form.standards}
                onChange={(v) => set("standards", v)}
                otherValue={form.standardsOther}
                onOtherChange={(v) => set("standardsOther", v)}
                otherPlaceholder="Tell us what you need clarity on"
              />
            </div>
          ) : null}

          {step === "inventory" ? (
            <div>
              {heading(
                "How do you track inventory?",
                "We look for sellers who can keep stock accurate.",
              )}
              <ChoiceList
                options={INVENTORY}
                value={form.inventorySystem}
                onChange={(v) => set("inventorySystem", v)}
                otherValue={form.inventoryOther}
                onOtherChange={(v) => set("inventoryOther", v)}
                otherPlaceholder="Describe your inventory process"
              />
            </div>
          ) : null}

          {step === "availability" ? (
            <div>
              {heading(
                "When can you fulfil orders?",
                "Rough operating pattern is enough.",
              )}
              <ChoiceList
                options={AVAILABILITY}
                value={form.availability}
                onChange={(v) => set("availability", v)}
                otherValue={form.availabilityOther}
                onOtherChange={(v) => set("availabilityOther", v)}
                otherPlaceholder="e.g. Mon-Sat 8am-6pm"
              />
            </div>
          ) : null}

          {step === "whyKlik" ? (
            <div>
              {heading(
                "Why do you want to sell on KlikCollect?",
                "A sentence or two about what you hope to achieve.",
              )}
              <textarea
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.whyKlik}
                onChange={(e) => set("whyKlik", e.target.value)}
                rows={5}
                placeholder="e.g. Reach more local customers without opening another shop..."
                className={`${field} mt-10 resize-none`}
              />
              <p className="mt-3 text-[12px] text-black/35">
                {form.whyKlik.trim().length}/15 characters minimum
              </p>
            </div>
          ) : null}

          {step === "referralSource" ? (
            <div>
              {heading(
                "How did you hear about us?",
                "Helps us understand what is working.",
              )}
              <ChoiceList
                options={REFERRAL_SOURCE}
                value={form.referralSource}
                onChange={(v) => set("referralSource", v)}
                otherValue={form.referralSourceOther}
                onOtherChange={(v) => set("referralSourceOther", v)}
                otherPlaceholder="Tell us how you found KlikCollect"
              />
            </div>
          ) : null}

          {step === "contact" ? (
            <div>
              {heading(
                "How do we reach you?",
                "Used for application updates only.",
              )}
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                placeholder="Your name"
                className={`${field} mt-10`}
                autoComplete="name"
              />
              <input
                type="email"
                value={user?.email || form.contactEmail}
                onChange={(e) => {
                  if (isSignedIn) return;
                  set("contactEmail", e.target.value);
                }}
                readOnly={Boolean(isSignedIn && user?.email)}
                placeholder="Email"
                className={`${field} mt-6 ${
                  isSignedIn && user?.email ? "opacity-70" : ""
                }`}
                autoComplete="email"
              />
              {isSignedIn && user?.email ? (
                <p className="mt-2 text-[12px] text-black/35">
                  Locked to your signed-in account email.
                </p>
              ) : null}
              <input
                type="tel"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                placeholder="Phone (optional)"
                className={`${field} mt-6`}
                autoComplete="tel"
              />
            </div>
          ) : null}

          {step === "presence" ? (
            <div>
              {heading(
                "Online presence",
                "Optional. Helps us verify your brand.",
              )}
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="Website"
                className={`${field} mt-10`}
                autoComplete="url"
              />
              <input
                value={form.instagram}
                onChange={(e) => set("instagram", e.target.value)}
                placeholder="Instagram"
                className={`${field} mt-6`}
              />
              <input
                value={form.tiktok}
                onChange={(e) => set("tiktok", e.target.value)}
                placeholder="TikTok"
                className={`${field} mt-6`}
              />
              <input
                value={form.socialOther}
                onChange={(e) => set("socialOther", e.target.value)}
                placeholder="Other link or handle"
                className={`${field} mt-6`}
              />
            </div>
          ) : null}

          {step === "notes" ? (
            <div>
              {heading(
                "Anything else we should know?",
                "Optional. Certifications, storage quirks, peak hours...",
              )}
              <textarea
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={5}
                placeholder="Add any extra detail"
                className={`${field} mt-10 resize-none`}
              />
            </div>
          ) : null}

          {step === "review" ? (
            <div>
              {heading(
                "Review and submit",
                "Confirm everything looks right before you send.",
              )}
              <dl className="mt-10 space-y-5 border-t border-black/[0.06] pt-6 text-[14px]">
                {(
                  [
                    ["Business", form.businessName],
                    [
                      "Type",
                      labelOf(
                        BUSINESS_TYPES,
                        form.businessType,
                        form.businessTypeOther,
                      ),
                    ],
                    [
                      "Years",
                      labelOf(
                        YEARS,
                        form.yearsOperating,
                        form.yearsOperatingOther,
                      ),
                    ],
                    [
                      "Team",
                      labelOf(TEAM_SIZE, form.teamSize, form.teamSizeOther),
                    ],
                    ["Pitch", form.pitch],
                    [
                      "Categories",
                      [
                        ...form.categories.filter((c) => c !== "other"),
                        form.categories.includes("other")
                          ? form.categoryOther.trim()
                          : "",
                      ]
                        .filter(Boolean)
                        .join(", "),
                    ],
                    [
                      "Sourcing",
                      labelOf(SOURCING, form.sourcing, form.sourcingOther),
                    ],
                    [
                      "Location",
                      [form.neighbourhood, form.city]
                        .filter(Boolean)
                        .join(", "),
                    ],
                    [
                      "Storage",
                      labelOf(STORAGE, form.storage, form.storageOther),
                    ],
                    [
                      "Fulfilment",
                      labelOf(
                        FULFILMENT,
                        form.fulfilment,
                        form.fulfilmentOther,
                      ),
                    ],
                    ["Service areas", form.serviceAreas],
                    [
                      "Lead time",
                      labelOf(LEAD_TIMES, form.leadTime, form.leadTimeOther),
                    ],
                    [
                      "Catalogue",
                      labelOf(
                        PRODUCT_COUNTS,
                        form.productCount,
                        form.productCountOther,
                      ),
                    ],
                    [
                      "Payments",
                      labelOf(
                        PAYMENT_METHODS,
                        form.paymentMethods,
                        form.paymentMethodsOther,
                      ),
                    ],
                    [
                      "Returns",
                      labelOf(
                        RETURNS_POLICY,
                        form.returnsPolicy,
                        form.returnsPolicyOther,
                      ),
                    ],
                    [
                      "Packaging",
                      labelOf(PACKAGING, form.packaging, form.packagingOther),
                    ],
                    [
                      "Peak season",
                      labelOf(
                        PEAK_SEASON,
                        form.peakSeason,
                        form.peakSeasonOther,
                      ),
                    ],
                    [
                      "Photography",
                      labelOf(
                        YES_NO,
                        form.photographyReady,
                        form.photographyOther,
                      ),
                    ],
                    [
                      "Registered",
                      labelOf(
                        YES_NO,
                        form.businessRegistered,
                        form.registeredOther,
                      ),
                    ],
                    [
                      "Inventory",
                      labelOf(
                        INVENTORY,
                        form.inventorySystem,
                        form.inventoryOther,
                      ),
                    ],
                    [
                      "Standards",
                      labelOf(STANDARDS, form.standards, form.standardsOther),
                    ],
                    [
                      "Availability",
                      labelOf(
                        AVAILABILITY,
                        form.availability,
                        form.availabilityOther,
                      ),
                    ],
                    ["Why KlikCollect", form.whyKlik],
                    [
                      "Referral",
                      labelOf(
                        REFERRAL_SOURCE,
                        form.referralSource,
                        form.referralSourceOther,
                      ),
                    ],
                    ["Contact", form.contactName],
                    ["Email", form.contactEmail],
                    ["Phone", form.contactPhone || "-"],
                    ["Website", form.website || "-"],
                    ["Instagram", form.instagram || "-"],
                    ["TikTok", form.tiktok || "-"],
                    ["Other social", form.socialOther || "-"],
                    ["Notes", form.notes || "-"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div
                    key={k}
                    className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-black/[0.06] pb-4"
                  >
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-black/35">
                      {k}
                    </dt>
                    <dd className="text-black/75">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex min-h-[50vh] flex-col justify-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/40">
                {isEdit ? "Saved" : "Received"}
              </p>
              <h2 className="mt-5 text-[clamp(1.85rem,5vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.03em]">
                {isEdit ? "Application updated" : "Application submitted"}
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-black/50">
                Reference <span className="text-black/80">{refId}</span>. Track
                live status in the popup, and find a copy in your notifications
                inbox.
              </p>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  if (onTrack) {
                    setTimeout(onTrack, 300);
                  } else {
                    window.dispatchEvent(
                      new CustomEvent("kc:open-sell-tracker"),
                    );
                  }
                }}
                className="mt-8 inline-flex min-h-12 w-fit items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80"
              >
                Track application
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-8 text-[14px] text-red-700">{error}</p>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-black/10 bg-[#f7f7f5]/95 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
          {step === "welcome" ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="min-h-11 px-2 text-[13px] text-black/45 transition-colors hover:text-black"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={goNext}
                className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80"
              >
                Start
              </button>
            </>
          ) : null}

          {step !== "welcome" && step !== "done" && step !== "review" ? (
            <>
              <button
                type="button"
                onClick={goBack}
                className="min-h-11 px-2 text-[13px] text-black/45 transition-colors hover:text-black"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canContinue}
                className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                Continue
              </button>
            </>
          ) : null}

          {step === "review" ? (
            <>
              <button
                type="button"
                onClick={goBack}
                className="min-h-11 px-2 text-[13px] text-black/45 transition-colors hover:text-black"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80 disabled:opacity-45"
              >
                {busy
                  ? isEdit
                    ? "Saving..."
                    : "Submitting..."
                  : isEdit
                    ? "Save changes"
                    : "Submit application"}
              </button>
            </>
          ) : null}

          {step === "done" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  if (onTrack) {
                    setTimeout(onTrack, 300);
                  } else {
                    window.dispatchEvent(
                      new CustomEvent("kc:open-sell-tracker"),
                    );
                  }
                }}
                className="min-h-11 px-2 text-[13px] text-black/45 underline underline-offset-[5px] decoration-black/20 hover:text-black hover:decoration-black"
              >
                Track status
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-12 items-center bg-black px-7 text-[12px] font-medium uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-80"
              >
                Done
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
