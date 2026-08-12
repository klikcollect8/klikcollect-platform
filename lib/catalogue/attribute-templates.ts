export type AttributeField = {
  key: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  unit?: string;
};

export const GROCERY_ATTRIBUTES: AttributeField[] = [
  { key: "weight", label: "Weight", type: "text", unit: "g/kg" },
  { key: "volume", label: "Volume", type: "text", unit: "ml/L" },
  { key: "pack_size", label: "Pack size", type: "text" },
  { key: "quantity", label: "Quantity (resolver)", type: "text" },
  { key: "unit", label: "Unit", type: "text" },
  { key: "unit_type", label: "Unit type", type: "select", options: ["Single", "Pack", "Case"] },
  { key: "serving_size", label: "Serving size", type: "text" },
  { key: "ingredients", label: "Ingredients", type: "text" },
  { key: "allergens", label: "Allergens", type: "text" },
  { key: "additives", label: "Additives", type: "text" },
  { key: "traces", label: "Traces", type: "text" },
  { key: "dietary", label: "Dietary", type: "text" },
  { key: "vegan", label: "Vegan", type: "select", options: ["yes", "no"] },
  { key: "vegetarian", label: "Vegetarian", type: "select", options: ["yes", "no"] },
  { key: "palm_oil", label: "Palm oil", type: "select", options: ["yes", "no"] },
  { key: "country_of_origin", label: "Country of origin", type: "text" },
  { key: "origins", label: "Origins", type: "text" },
  { key: "storage", label: "Storage instructions", type: "text" },
  { key: "packaging", label: "Packaging", type: "text" },
  { key: "nutriscore", label: "Nutri-Score", type: "text" },
  { key: "nova_group", label: "NOVA group", type: "text" },
  { key: "ecoscore", label: "Eco-Score", type: "text" },
  { key: "labels", label: "Labels", type: "text" },
  { key: "countries", label: "Countries", type: "text" },
  { key: "stores", label: "Stores", type: "text" },
  { key: "generic_name", label: "Generic name", type: "text" },
  { key: "pnns_group", label: "PNNS group", type: "text" },
  { key: "food_group", label: "Food group", type: "text" },
  { key: "emb_codes", label: "EMB codes", type: "text" },
  { key: "producer_link", label: "Producer link", type: "text" },
];

export const ELECTRONICS_ATTRIBUTES: AttributeField[] = [
  { key: "model", label: "Model", type: "text" },
  { key: "storage", label: "Storage", type: "text" },
  { key: "ram", label: "RAM", type: "text" },
  { key: "screen_size", label: "Screen size", type: "text" },
  { key: "colour", label: "Colour", type: "text" },
  { key: "connectivity", label: "Connectivity", type: "text" },
  { key: "warranty", label: "Warranty", type: "text" },
];

export const CLOTHING_ATTRIBUTES: AttributeField[] = [
  { key: "gender", label: "Gender", type: "select", options: ["Women", "Men", "Unisex", "Kids"] },
  { key: "size", label: "Size", type: "text" },
  { key: "colour", label: "Colour", type: "text" },
  { key: "material", label: "Material", type: "text" },
  { key: "fit", label: "Fit", type: "text" },
];

export function attributesForCategoryPath(path?: string | null): AttributeField[] {
  const p = String(path || "").toLowerCase();
  if (/electr|phone|laptop|audio/.test(p)) return ELECTRONICS_ATTRIBUTES;
  if (/cloth|apparel|fashion|shoe/.test(p)) return CLOTHING_ATTRIBUTES;
  return GROCERY_ATTRIBUTES;
}
