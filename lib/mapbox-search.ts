/**
 * Back-compat re-exports — prefer `@/lib/mapbox-api` for new code.
 * Includes Search Box, Directions, Map Matching, Matrix, Isochrone helpers.
 */
export {
  suggestAddresses,
  retrieveAddress,
  forwardGeocode,
  reverseGeocode,
  searchBoxForward,
  searchBoxReverse,
  searchBoxReverseMany,
  searchCategory,
  featureTypeLabel,
  fetchDirections,
  fetchDirectionsAll,
  fetchOptimizedTrip,
  matchTraceToRoads,
  fetchTravelMatrix,
  fetchEtasFromOrigin,
  fetchIsochrone,
  estimateOfflineTiles,
  estimateNairobiOfflinePack,
  type AddressSuggestion,
  type DirectionStep,
  type DirectionsResult,
  type OptimizedTripResult,
  type TravelProfile,
  type LngLat,
  type MatrixResult,
  type OfflineEstimate,
} from "@/lib/mapbox-api";
