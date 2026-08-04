"use client";

import { Product } from "@/types";

interface ProductSpecificationsProps {
  product: Product;
}

export default function ProductSpecifications({
  product,
}: ProductSpecificationsProps) {
  // Generate specifications based on product category
  const getSpecifications = () => {
    const stock = product.stock ?? 0; // Default to 0 if undefined/null

    const baseSpecs = [
      { label: "Product Name", value: product.name || "N/A" },
      { label: "Category", value: product.category || "N/A" },
      { label: "SKU", value: product.id || "N/A" },
      { label: "Availability", value: stock > 0 ? "In Stock" : "Out of Stock" },
      { label: "Stock Quantity", value: stock.toString() },
    ];

    // Add category-specific specs
    if (product.category === "Electronics") {
      return [
        ...baseSpecs,
        { label: "Brand", value: "KlikCollect" },
        { label: "Model", value: product.name.split(" ")[0] },
        { label: "Warranty", value: "1 Year Manufacturer Warranty" },
        {
          label: "Color",
          value:
            product.variations?.find((v) => v.name === "Color")?.selected ||
            "N/A",
        },
        { label: "Dimensions", value: "Varies by model" },
        { label: "Weight", value: "Varies by model" },
      ];
    }

    if (product.category === "Sports & Outdoors") {
      return [
        ...baseSpecs,
        { label: "Material", value: "Premium Quality" },
        {
          label: "Color",
          value:
            product.variations?.find((v) => v.name === "Color")?.selected ||
            "N/A",
        },
        {
          label: "Size",
          value:
            product.variations?.find((v) => v.name === "Size")?.selected ||
            "One Size",
        },
        { label: "Care Instructions", value: "Machine washable" },
      ];
    }

    return baseSpecs;
  };

  const specifications = getSpecifications();

  return (
    <div>
      <h3 className="text-xl font-light text-gray-900 mb-6">Specifications</h3>
      <div className="space-y-0 border border-gray-100 rounded-xl overflow-hidden">
        {specifications.map((spec, idx) => (
          <div
            key={idx}
            className={`flex items-start py-4 px-6 border-b border-gray-100 last:border-b-0 ${
              idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
            }`}
          >
            <dt className="w-1/3 text-sm font-medium text-gray-900 pr-4">
              {spec.label}
            </dt>
            <dd className="flex-1 text-sm text-gray-600">{spec.value}</dd>
          </div>
        ))}
      </div>
    </div>
  );
}
