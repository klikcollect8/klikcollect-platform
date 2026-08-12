export {
  resolveBarcode,
  searchProducts,
  findSimilarProducts,
  listConfiguredProviders,
} from "@/lib/product-resolver/resolve";
export { commitResolvedProduct } from "@/lib/product-resolver/commit";
export {
  mergeProviderResults,
  candidateCompleteness,
  candidateToAttributes,
  mapPerishabilityToDb,
} from "@/lib/product-resolver/merge";
export { findLocalProductByBarcode } from "@/lib/product-resolver/providers/klikcollect";
export {
  listDiscoveryCandidates,
  upsertDiscoveryCandidate,
  dismissDiscoveryCandidate,
  restoreDiscoveryCandidate,
  bulkUpdateDiscoveryStatus,
  getDiscoveryCandidate,
  countDiscoveryByStatus,
  listDiscoveryBrands,
} from "@/lib/product-resolver/discovery";
export type * from "@/lib/product-resolver/types";
