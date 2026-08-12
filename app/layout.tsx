import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import MaintenanceCheck from "@/components/MaintenanceCheck";
import { ToastProvider } from "@/components/ToastProvider";
import { SignInModalProvider } from "@/components/SignInModalProvider";
import CapacitorInit from "@/components/CapacitorInit";
import ClerkSessionRecovery from "@/components/ClerkSessionRecovery";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import AccountRestrictionCheck from "@/components/AccountRestrictionCheck";
import AppChrome from "@/components/AppChrome";
import { cn } from "@/lib/utils";
import QueryProvider from "@/components/providers/QueryProvider";
import { LocationProvider } from "@/components/providers/LocationProvider";
import { ActiveLocationProvider } from "@/components/providers/ActiveLocationProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { clerkAppearance } from "@/lib/clerk-appearance";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "600"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "KlikCollect - Groceries & everyday essentials",
    template: "%s · KlikCollect",
  },
  description:
    "A curated marketplace building commerce systems for brands and vendors that want to be seen for what they are. Nairobi · KES · click & collect.",
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#f7f7f5",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-KE"
      className={cn(jakarta.variable)}
      suppressHydrationWarning
    >
      <body className={cn("antialiased", jakarta.className)}>
        <ClerkProvider
          appearance={clerkAppearance}
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          afterSignOutUrl="/"
        >
          <PostHogProvider>
            <QueryProvider>
              <LocationProvider>
                <ActiveLocationProvider>
                <CartProvider>
                  <CapacitorInit />
                  <ClerkSessionRecovery />
                  <InstallAppPrompt />
                  <MaintenanceCheck>
                    <ToastProvider>
                      <SignInModalProvider>
                        <AccountRestrictionCheck />
                        <AppChrome>{children}</AppChrome>
                      </SignInModalProvider>
                    </ToastProvider>
                  </MaintenanceCheck>
                  <Toaster position="top-right" richColors />
                </CartProvider>
                </ActiveLocationProvider>
              </LocationProvider>
            </QueryProvider>
          </PostHogProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
