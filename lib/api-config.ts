import { Capacitor } from "@capacitor/core";

/**
 * API base URL helper.
 * Prefer remote-URL Capacitor (`CAPACITOR_SERVER_URL`): the WebView shares the
 * hosted origin, so relative `/api/*` works and this helper is usually unused.
 */
export function getApiUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return (
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.CAPACITOR_SERVER_URL ||
      ""
    );
  }
  return "";
}

/**
 * Helper to make API calls that work in both web and native
 */
export async function apiFetch(
  endpoint: string,
  options?: RequestInit,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint;

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}
