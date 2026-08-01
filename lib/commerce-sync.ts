/**
 * @deprecated Catalogue truth is Supabase-native.
 * Kept as a no-op so older callers do not break builds.
 */

export function isCommerceSyncEnabled() {
  return false;
}

export type SyncResult = {
  attempted: boolean;
  synced: number;
  error?: string;
};

export async function syncCatalogueToSupabase(): Promise<SyncResult> {
  return { attempted: false, synced: 0 };
}
