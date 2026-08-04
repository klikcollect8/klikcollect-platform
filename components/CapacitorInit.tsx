"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * Map custom-scheme / universal-link opens into in-app routes.
 * Supports klikcollect://path?query and https://host/path?query
 */
function pathFromAppUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol === "klikcollect:") {
      // klikcollect://sso-callback?x=1  → host is path segment
      // klikcollect:///account/orders → pathname only
      let path = url.pathname || "";
      if (url.hostname) {
        path = `/${url.hostname}${path.startsWith("/") ? path : path ? `/${path}` : ""}`;
      }
      if (!path.startsWith("/")) path = `/${path}`;
      path = path.replace(/\/{2,}/g, "/") || "/";
      return `${path}${url.search}${url.hash}`;
    }
    if (url.protocol === "https:" || url.protocol === "http:") {
      return `${url.pathname}${url.search}${url.hash}` || "/";
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function CapacitorInit() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handles: { remove: () => Promise<void> }[] = [];

    const initNativeFeatures = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#f7f7f5" });
        await SplashScreen.hide();
      } catch (error) {
        console.log("Native features not available:", error);
      }
    };

    const wireListeners = async () => {
      handles.push(
        await App.addListener("appStateChange", ({ isActive }) => {
          if (process.env.NODE_ENV === "development") {
            console.log("App state changed. Is active?", isActive);
          }
        }),
      );

      handles.push(
        await App.addListener("appUrlOpen", (data) => {
          const next = pathFromAppUrl(data.url);
          if (!next) return;
          // Clerk SSO, payment callbacks, shared links
          router.push(next);
        }),
      );

      handles.push(
        await Keyboard.addListener("keyboardWillShow", () => {
          document.documentElement.classList.add("kc-keyboard-open");
        }),
      );
      handles.push(
        await Keyboard.addListener("keyboardWillHide", () => {
          document.documentElement.classList.remove("kc-keyboard-open");
        }),
      );

      if (Capacitor.getPlatform() === "android") {
        handles.push(
          await App.addListener("backButton", ({ canGoBack }) => {
            if (!canGoBack) {
              void App.exitApp();
            } else {
              window.history.back();
            }
          }),
        );
      }
    };

    void initNativeFeatures();
    void wireListeners();

    return () => {
      document.documentElement.classList.remove("kc-keyboard-open");
      for (const h of handles) {
        void h.remove();
      }
    };
  }, [router]);

  return null;
}
