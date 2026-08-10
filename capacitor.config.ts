import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

/** Load CAPACITOR_SERVER_URL from .env.local / .env when Cap CLI runs. */
function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const serverUrl = (process.env.CAPACITOR_SERVER_URL || "").trim().replace(
  /\/$/,
  "",
);
const isHttpDev = serverUrl.startsWith("http://");

/**
 * Remote-URL Capacitor shell.
 * The WebView loads the hosted Next.js app (APIs, Clerk, payments).
 * `webDir` is only a local fallback splash when server.url is unset / offline.
 */
const config: CapacitorConfig = {
  appId: "com.klikcollect.app",
  appName: "KlikCollect",
  webDir: "capacitor/www",
  server: {
    // Production / LAN Next URL — required for the real app
    ...(serverUrl ? { url: serverUrl } : {}),
    cleartext: isHttpDev,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#f7f7f5",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      iosSpinnerStyle: "small",
      spinnerColor: "#0a0a0a",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#f7f7f5",
    },
    Keyboard: {
      // Keep fixed bottom nav stable; hide via .kc-keyboard-open instead
      resizeOnFullScreen: false,
    },
  },
  android: {
    allowMixedContent: isHttpDev,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    scheme: "klikcollect",
    contentInset: "automatic",
  },
};

export default config;
