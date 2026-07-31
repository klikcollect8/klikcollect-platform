import { promises as fs } from "fs";
import path from "path";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlags,
} from "@/lib/feature-flag-types";

export {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlagKey,
  type FeatureFlags,
} from "@/lib/feature-flag-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = "feature-flags.json";

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function mergeWithDefaults(partial: Partial<FeatureFlags>): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...partial };
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    return mergeWithDefaults(parsed);
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS };
  }
}

export async function setFeatureFlags(
  updates: Partial<FeatureFlags>,
): Promise<FeatureFlags> {
  const current = await getFeatureFlags();
  const next = mergeWithDefaults({ ...current, ...updates });
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, FILE),
    JSON.stringify(next, null, 2),
    "utf8",
  );
  return next;
}

/** Ensure keys from FEATURE_FLAG_KEYS stay in sync for API validation. */
export function isFeatureFlagKey(key: string): boolean {
  return (FEATURE_FLAG_KEYS as readonly string[]).includes(key);
}
