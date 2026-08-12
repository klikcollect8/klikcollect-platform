"use client";

import ProductDataVisual from "@/components/admin/catalogue/ProductDataVisual";
import type {
  ResolveResult,
  SimilarProductHit,
} from "@/lib/product-resolver/types";

type Props = {
  result: ResolveResult;
  context: "catalogue" | "discovery" | "page";
  onResolveBarcode?: (barcode: string) => void;
  onEnqueueVariant?: (hit: SimilarProductHit) => void;
};

export default function ProductVisualBoard({
  result,
  context,
  onResolveBarcode,
  onEnqueueVariant,
}: Props) {
  const local = result.localProduct;
  const c = result.candidate;

  return (
    <ProductDataVisual
      data={{
        name: local?.name || c?.name?.value || null,
        brand: local?.brand || c?.brand?.value || null,
        barcode: result.barcode,
        format: result.format,
        image: local?.image || c?.images?.[0]?.url || null,
        quantity: c?.quantity?.value || null,
        statusLabel: local
          ? "In catalogue"
          : result.resolutionStatus.replace(/_/g, " "),
        localProduct: local,
        candidate: c,
        providerResults: result.providerResults,
        similarProducts: result.similarProducts,
        showVariants: context === "discovery",
      }}
      onResolveBarcode={onResolveBarcode}
      onEnqueueVariant={onEnqueueVariant}
    />
  );
}
