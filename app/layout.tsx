import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ConditionalHeader from "@/components/ConditionalHeader";
import { ConditionalFooter } from "@/components/ConditionalHeader";
import MaintenanceCheck from "@/components/MaintenanceCheck";
import { ToastProvider } from "@/components/ToastProvider";
import { SignInModalProvider } from "@/components/SignInModalProvider";
import CapacitorInit from "@/components/CapacitorInit";
import AccountRestrictionCheck from "@/components/AccountRestrictionCheck";
import BottomNav from "@/components/BottomNav";
import ShellMain from "@/components/ShellMain";
import ObscuraLoader from "@/components/obscura/ObscuraLoader";
import { cn } from "@/lib/utils";
import QueryProvider from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/components/providers/PostHogProvider";

const montreal = localFont({
  src: "../public/obscura/fonts/NeueMontreal-Medium.otf",
  variable: "--font-montreal",
  weight: "500",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KlikCollect — Groceries & everyday essentials",
    template: "%s · KlikCollect",
  },
  description:
    "A curated marketplace building commerce systems for brands and vendors that want to be seen for what they are. Nairobi · KES · click & collect.",
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.svg", sizes: "32x32", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.svg", type: "image/svg+xml" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
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
    <html lang="en-KE" className={cn(montreal.variable)} suppressHydrationWarning>
      <body className="antialiased font-[family-name:var(--font-montreal)]">
        <ClerkProvider appearance={{ theme: shadcn }}>
          <PostHogProvider>
            <QueryProvider>
              <CapacitorInit />
              <MaintenanceCheck>
                <ToastProvider>
                  <SignInModalProvider>
                    <AccountRestrictionCheck />
                    <ObscuraLoader />
                    <ConditionalHeader />
                    <ShellMain>{children}</ShellMain>
                    <ConditionalFooter />
                    <BottomNav />
                  </SignInModalProvider>
                </ToastProvider>
              </MaintenanceCheck>
              <Toaster position="top-right" richColors />
            </QueryProvider>
          </PostHogProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
