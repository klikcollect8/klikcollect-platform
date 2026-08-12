export { resolveBarcode, listConfiguredProviders } from "@/lib/product-resolver/resolve";
export { commitResolvedProduct } from "@/lib/product-resolver/commit";
export { mergeProviderResults, candidateCompleteness } from "@/lib/product-resolver/merge";
export { findLocalProductByBarcode } from "@/lib/product-resolver/providers/klikcollect";
export type * from "@/lib/product-resolver/types";
