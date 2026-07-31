/**
 * Binding curation policy from docs/01_Product_Vision.md §8 (RATIFIED).
 * Do not invent criteria — only encode what Chapter 01 already decided.
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
  { id: "counterfeit", label: "Counterfeit goods", nature: "Trust-destroying; zero tolerance" },
  { id: "unsafe", label: "Unsafe products", nature: "Customer harm" },
  { id: "misleading", label: "Misleading listings", nature: "Trust-destroying" },
  { id: "spam", label: "Low-quality or spam sellers", nature: "Brand dilution" },
  { id: "poor_fulfilment", label: "Poor fulfilment standards", nature: "Experience failure" },
  { id: "illegal", label: "Illegal products", nature: "Legal" },
  { id: "adult", label: "Adult content", nature: "Brand policy" },
  { id: "hate", label: "Hate or extremist merchandise", nature: "Brand policy" },
  { id: "fraud", label: "Fraudulent businesses", nature: "Legal + trust" },
] as const;

/** V1 launch categories — grocery / essentials focused catalogue */
export const V1_CATEGORIES = [
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

export type CurationApplication = {
  id: string;
  businessName: string;
  neighbourhood: string;
  contactEmail: string;
  contactPhone: string;
  categories: string[];
  notes?: string;
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
