"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";

export default function CapacitorInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Initialize Status Bar and Splash Screen
    const initNativeFeatures = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#000000" });
        await SplashScreen.hide();
      } catch (error) {
        console.log("Native features not available:", error);
      }
    };

    // Handle app state changes
    const handleAppState = () => {
      App.addListener("appStateChange", ({ isActive }) => {
        console.log("App state changed. Is active?", isActive);
      });

      App.addListener("appUrlOpen", (data) => {
        console.log("App opened with URL:", data.url);
      });
    };

    // Handle keyboard events
    const handleKeyboard = () => {
      Keyboard.addListener("keyboardWillShow", (info) => {
        console.log("Keyboard will show:", info);
      });

      Keyboard.addListener("keyboardWillHide", () => {
        console.log("Keyboard will hide");
      });
    };

    initNativeFeatures();
    handleAppState();
    handleKeyboard();

    // Prevent back button from closing app (Android)
    if (Capacitor.getPlatform() === "android") {
      App.addListener("backButton", ({ canGoBack }) => {
        if (!canGoBack) {
          App.exitApp();
        } else {
          window.history.back();
        }
      });
    }
  }, []);

  return null;
}
