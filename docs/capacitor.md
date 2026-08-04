# Capacitor — native Android / iOS shell

KlikCollect’s native apps are a **remote-URL Capacitor shell**. The WebView loads your hosted Next.js site (`CAPACITOR_SERVER_URL`), so Clerk, `/api/*`, Stripe, and Paystack keep working on the server.

Static export alone cannot run this product (API routes + middleware + payments).

## Prerequisites

- Node 20+
- [Android Studio](https://developer.android.com/studio) (Windows / macOS / Linux)
- Xcode + CocoaPods (macOS only, for iOS)
- A running Next deploy or local `npm run dev` reachable from the device

## Environment

In `.env.local`:

```bash
# Production
CAPACITOR_SERVER_URL=https://your-production-domain.com

# Or local device testing (LAN IP of the machine running Next)
CAPACITOR_SERVER_URL=http://192.168.1.10:3000
```

`capacitor.config.ts` loads `.env.local` / `.env` when you run Cap CLI commands.

### Clerk

In the Clerk Dashboard, allow redirect URLs for:

- Your HTTPS production origin (and localhost for web)
- Custom scheme: `klikcollect://*` (SSO / magic-link returns)

### Cleartext HTTP (dev only)

`cleartext` / `allowMixedContent` are enabled only when `CAPACITOR_SERVER_URL` starts with `http://`.

## Commands

```bash
# Ensure fallback splash exists + sync web assets into native projects
npm run cap:sync

# First-time platforms
npm run cap:add:android
# on macOS:
npm run cap:add:ios

# Open IDE
npm run cap:open:android
npm run cap:open:ios   # macOS
```

Dev loop:

1. `npm run dev` (or deploy preview)
2. Set `CAPACITOR_SERVER_URL` to that origin
3. `npm run cap:sync`
4. Run the app from Android Studio / Xcode

## Project layout

| Path | Role |
|------|------|
| `capacitor.config.ts` | App id, `server.url`, splash / status bar |
| `capacitor/www/` | Minimal offline fallback (not the full marketplace) |
| `android/` | Android Studio project |
| `ios/` | Xcode project (generate on macOS) |
| `components/CapacitorInit.tsx` | Status bar, splash, back button, deep links |

## Deep links

Custom scheme: `klikcollect://`

Examples:

- `klikcollect://sso-callback`
- `klikcollect://payment/callback?...`

`CapacitorInit` maps these into Next App Router paths via `router.push`.

## Test on iPhone (PWA — no Apple Developer needed)

A signed Capacitor `.ipa` still needs a Mac + Apple Developer / TestFlight. For device testing **now**:

The install QR always targets the **live site**
(`https://klikcollect-platform.vercel.app`, or `NEXT_PUBLIC_APP_URL`).

1. Open **Get the app** from the storefront burger menu or admin header
2. Scan the QR with your iPhone (opens the deployed URL, not localhost)
3. **Safari** → Share → **Add to Home Screen**

Popup: [`components/InstallAppPrompt.tsx`](../components/InstallAppPrompt.tsx). Add the production origin in Clerk allowed URLs if sign-in fails on device.

**Later (real Capacitor iOS):** build on macOS, distribute via TestFlight.

## Notes

- [`lib/api-config.ts`](../lib/api-config.ts) `getApiUrl()` / `apiFetch` are unused; with a remote URL, relative `/api/*` calls work inside the WebView.
- Do not commit keystores (`*.jks` / `*.keystore`) or `android/local.properties`.
- iOS builds require macOS; on Windows use Android only.
