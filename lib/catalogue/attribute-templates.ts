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
  { key: "unit_type", label: "Unit type", type: "select", options: ["Single", "Pack", "Case"] },
  { key: "ingredients", label: "Ingredients", type: "text" },
  { key: "allergens", label: "Allergens", type: "text" },
  { key: "dietary", label: "Dietary", type: "text" },
  { key: "country_of_origin", label: "Country of origin", type: "text" },
  { key: "storage", label: "Storage instructions", type: "text" },
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
