"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Map custom-scheme / universal-link opens into in-app routes.
 * Supports klikcollect://path?query and https://host/path?query
 */
function pathFromAppUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol === "klikcollect:") {
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

/** Capacitor plugins load only on native — keeps web first paint light. */
export default function CapacitorInit() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const handles: { remove: () => Promise<void> }[] = [];

    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (cancelled || !Capacitor.isNativePlatform()) return;

      document.documentElement.classList.add("kc-native");

      const [{ App }, { StatusBar, Style }, { Keyboard }, { SplashScreen }] =
        await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/status-bar"),
          import("@capacitor/keyboard"),
          import("@capacitor/splash-screen"),
        ]);

      if (cancelled) return;

      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#f7f7f5"});
        if (Capacitor.getPlatform() === "android") {
          try {
            await StatusBar.setOverlaysWebView({ overlay: false });
          } catch {
            /* older plugin */
          }
        }
        await SplashScreen.hide();
      } catch (error) {
        console.log("Native features not available:", error);
      }

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
          router.push(next);
        }),
      );

      const setKeyboardOpen = (open: boolean) => {
        document.documentElement.classList.toggle("kc-keyboard-open", open);
      };

      handles.push(
        await Keyboard.addListener("keyboardWillShow", () => {
          setKeyboardOpen(true);
        }),
      );
      handles.push(
        await Keyboard.addListener("keyboardDidShow", () => {
          setKeyboardOpen(true);
        }),
      );
      handles.push(
        await Keyboard.addListener("keyboardWillHide", () => {
          setKeyboardOpen(false);
        }),
      );
      handles.push(
        await Keyboard.addListener("keyboardDidHide", () => {
          setKeyboardOpen(false);
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
    })();

    return () => {
      cancelled = true;
      document.documentElement.classList.remove(
        "kc-keyboard-open",
        "kc-native",
      );
      for (const h of handles) {
        void h.remove();
      }
    };
  }, [router]);

  return null;
}
