import { Capacitor } from '@capacitor/core';

/**
 * Get the API base URL for the current environment
 * In native apps, API routes don't work, so we need to point to a hosted backend
 */
export function getApiUrl(): string {
  // If running in Capacitor native app
  if (Capacitor.isNativePlatform()) {
    // Use environment variable or fallback to your production API URL
    return process.env.NEXT_PUBLIC_API_URL || 'https://your-api-domain.com';
  }
  
  // If running in browser (web), use relative URLs for API routes
  return '';
}

/**
 * Helper to make API calls that work in both web and native
 */
export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint;
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

