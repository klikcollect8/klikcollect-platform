/** Paths where the fixed mobile bottom nav is hidden. */
export function showsMobileBottomNav(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  // Keep bottom nav on account (Orders / Profile flows); hide only dense shells.
  return !(
    pathname.startsWith("/admin") ||
    pathname.startsWith("/code-admin") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/maps") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/cart")
  );
}
