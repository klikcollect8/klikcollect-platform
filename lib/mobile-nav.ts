/** Paths where the fixed mobile bottom nav is hidden. */
export function showsMobileBottomNav(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !(
    pathname.startsWith("/admin") ||
    pathname.startsWith("/code-admin") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/cart")
  );
}
