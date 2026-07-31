/** Client-safe feature flag types (no Node fs). */

export const FEATURE_FLAG_KEYS = ["pos", "couriers", "marketing", "finance"] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  pos: false,
  couriers: false,
  marketing: false,
  finance: false,
};
