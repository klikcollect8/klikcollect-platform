import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isAdminPublic = createRouteMatcher(["/admin/login(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isOsRoute = createRouteMatcher(["/app(.*)"]);
const isAccountRoute = createRouteMatcher(["/account(.*)"]);
/** Session-required APIs (handlers still enforce permissions). Webhooks stay public. */
const isProtectedApi = createRouteMatcher([
  "/api/admin(.*)",
  "/api/os(.*)",
  "/api/user(.*)",
  "/api/me(.*)",
]);

/** Platform-only legacy /app paths - bounce before page render. */
const OS_PLATFORM_REDIRECTS: Record<string, string> = {
  "/app/marketplace": "/admin/vendors",
  "/app/curation": "/admin/vendors",
  "/app/warehouse": "/admin",
  "/app/marketing": "/admin",
  "/app/analytics": "/admin/analytics",
  "/app/kyc": "/admin/compliance",
  "/app/ai": "/app",
};

/**
 * Clerk authenticates admin, vendor OS, and customer account.
 * Do NOT await Supabase session refresh here - it was blocking every request
 * when the network/API was slow and made the whole site appear stuck loading.
 */
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const pathname = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  const platformTarget = OS_PLATFORM_REDIRECTS[pathname];
  if (platformTarget) {
    return NextResponse.redirect(new URL(platformTarget, request.url));
  }

  // Legacy Uber-style surfaces → homepage
  if (
    pathname === "/eats" ||
    pathname.startsWith("/eats/") ||
    pathname === "/delivery" ||
    pathname.startsWith("/delivery/") ||
    pathname === "/app/couriers" ||
    pathname.startsWith("/app/couriers/")
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isProtectedApi(request)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", authenticated: false },
        { status: 401 },
      );
    }
  }

  const needsAuth =
    (isAdminRoute(request) && !isAdminPublic(request)) ||
    isOsRoute(request) ||
    isAccountRoute(request);

  if (needsAuth) {
    const { userId } = await auth();
    if (!userId) {
      const loginPath = isAdminRoute(request) ? "/admin/login" : "/sign-in";
      const redirectUrl = new URL(loginPath, request.url);
      const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      // Dual-write: bridge reads `redirect`; Clerk often uses `redirect_url`.
      redirectUrl.searchParams.set("redirect", returnTo);
      redirectUrl.searchParams.set("redirect_url", returnTo);
      return NextResponse.redirect(redirectUrl);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: [
    /*
     * Run Clerk on pages + authenticated APIs only.
     * Public catalogue APIs are excluded so storefront reads stay fast.
     */
    "/((?!_next|api/products|api/categories|api/vendors|api/banner-slides|api/settings|api/search|api/changelog|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
