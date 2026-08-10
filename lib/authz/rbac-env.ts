/**
 * Shared RBAC environment flags.
 * Production always disables soft-open / file / metadata shortcuts.
 */

export function softOpenDemoVendor(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  // Explicit false wins; otherwise default ON in non-production so local /app works.
  if (process.env.RBAC_SOFT_OPEN_DEMO === "false") return false;
  return true;
}

export function shouldUseFileMembershipFallback(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.RBAC_FILE_MEMBERSHIPS === "false") return false;
  return true;
}

export function allowMetadataVendorShortcut(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.RBAC_ALLOW_METADATA_VENDOR === "true";
}
