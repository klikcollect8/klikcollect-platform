/**
 * Binding curation policy from docs/01_Product_Vision.md §8 (RATIFIED).
 * Do not invent criteria - only encode what Chapter 01 already decided.
 */

export const ADMISSION_CRITERIA = [
  { id: "product_quality", label: "Product quality" },
  { id: "brand_presentation", label: "Brand presentation" },
  { id: "customer_service", label: "Customer service standards" },
  { id: "fulfilment", label: "Reliable fulfilment capability" },
  { id: "inventory", label: "Inventory management capability" },
  { id: "photography", label: "Professional product photography" },
  { id: "descriptions", label: "Honest product descriptions" },
  { id: "legitimacy", label: "Business legitimacy" },
  { id: "satisfaction", label: "Commitment to customer satisfaction" },
] as const;

export const REJECTION_CLASSES = [
  {
    id: "counterfeit",
    label: "Counterfeit goods",
    nature: "Trust-destroying; zero tolerance",
  },
  { id: "unsafe", label: "Unsafe products", nature: "Customer harm" },
  {
    id: "misleading",
    label: "Misleading listings",
    nature: "Trust-destroying",
  },
  {
    id: "spam",
    label: "Low-quality or spam sellers",
    nature: "Brand dilution",
  },
  {
    id: "poor_fulfilment",
    label: "Poor fulfilment standards",
    nature: "Experience failure",
  },
  { id: "illegal", label: "Illegal products", nature: "Legal" },
  { id: "adult", label: "Adult content", nature: "Brand policy" },
  {
    id: "hate",
    label: "Hate or extremist merchandise",
    nature: "Brand policy",
  },
  { id: "fraud", label: "Fraudulent businesses", nature: "Legal + trust" },
] as const;

/** V1 launch categories - flat grocery / essentials catalogue (no nesting) */
export const V1_CATEGORIES = [
  // Original departments
  "Groceries",
  "General Essentials",
  "Fresh Produce",
  "Pantry",
  "Dairy & Eggs",
  "Beverages",
  "Household Essentials",
  "Snacks",
  "Home & Kitchen",
  "Health & Wellness (non-prescription)",
  // Additional flat categories
  "Rice & Grains",
  "Cooking Oils",
  "Sugar & Salt",
  "Instant Meals",
  "Breakfast Staples",
  "Personal Care",
  "Oral Care",
  "Baby Care",
  "First Aid",
  "Leafy Greens",
  "Fruit",
  "Vegetables",
  "Herbs & Spices",
  "Roots & Tubers",
  "Sauces & Condiments",
  "Canned Goods",
  "Pasta & Noodles",
  "Baking",
  "Milk",
  "Yoghurt",
  "Cheese",
  "Eggs",
  "Butter & Spreads",
  "Water",
  "Soft Drinks",
  "Juice",
  "Tea & Coffee",
  "Laundry",
  "Cleaning",
  "Paper Goods",
  "Crisps & Chips",
  "Biscuits",
  "Nuts & Seeds",
  "Chocolate & Sweets",
  "Cookware",
  "Kitchen Tools",
  "Food Storage",
  "Vitamins & Supplements",
  "Cold & Flu Care",
] as const;

export const V1_EXCLUDED_CATEGORIES = [
  "Prescription pharmacy",
  "Controlled medicines",
  "Firearms",
  "Alcohol",
  "Tobacco",
  "Gambling",
  "Adult products",
  "Financial products",
  "Vehicles",
  "Real estate",
] as const;

export type AdmissionCriterionId = (typeof ADMISSION_CRITERIA)[number]["id"];
export type RejectionClassId = (typeof REJECTION_CLASSES)[number]["id"];

/** Extra answers from the multi-step sell application wizard */
export type CurationApplicationDetails = {
  pitch?: string;
  city?: string;
  businessType?: string;
  businessTypeOther?: string;
  yearsOperating?: string;
  yearsOperatingOther?: string;
  categoryOther?: string;
  storage?: string;
  storageOther?: string;
  fulfilment?: string;
  fulfilmentOther?: string;
  serviceAreas?: string;
  leadTime?: string;
  leadTimeOther?: string;
  productCount?: string;
  productCountOther?: string;
  photographyReady?: string;
  photographyOther?: string;
  businessRegistered?: string;
  registeredOther?: string;
  inventorySystem?: string;
  inventoryOther?: string;
  website?: string;
  instagram?: string;
  tiktok?: string;
  socialOther?: string;
  availability?: string;
  availabilityOther?: string;
  contactName?: string;
  teamSize?: string;
  teamSizeOther?: string;
  sourcing?: string;
  sourcingOther?: string;
  paymentMethods?: string;
  paymentMethodsOther?: string;
  returnsPolicy?: string;
  returnsPolicyOther?: string;
  packaging?: string;
  packagingOther?: string;
  peakSeason?: string;
  peakSeasonOther?: string;
  whyKlik?: string;
  referralSource?: string;
  referralSourceOther?: string;
  standards?: string;
  standardsOther?: string;
};

/** Max times an applicant may edit a pending application after submit */
export const CURATION_MAX_EDITS = 3;

/** Max brand-new applications one user may create in a rolling window */
export const CURATION_MAX_SUBMITS_PER_WINDOW = 2;
export const CURATION_SUBMIT_WINDOW_DAYS = 30;

export type CurationApplication = {
  id: string;
  businessName: string;
  neighbourhood: string;
  contactEmail: string;
  contactPhone: string;
  categories: string[];
  notes?: string;
  details?: CurationApplicationDetails;
  clerkUserId?: string;
  editCount: number;
  updatedAt?: string;
  status: "pending" | "admitted" | "rejected";
  createdAt: string;
  decision?: CurationDecision;
};

export type CurationDecision = {
  decidedAt: string;
  decidedBy: string;
  outcome: "admitted" | "rejected";
  criteriaChecked: AdmissionCriterionId[];
  rejectionClasses?: RejectionClassId[];
  reason: string;
};
