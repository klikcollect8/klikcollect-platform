import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
    return null;
  }

  return { url, anon };
}

/**
 * Creates a Supabase admin client using service role key (bypasses RLS)
 * Use this for server-side operations that need full database access
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.warn("[createAdminClient] NEXT_PUBLIC_SUPABASE_URL not found");
    return null;
  }

  if (!serviceRoleKey) {
    console.warn(
      "[createAdminClient] SUPABASE_SERVICE_ROLE_KEY not found in environment variables. Falling back to anon key (may be limited by RLS).",
    );
    return null;
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    // Return a mock client that will fail gracefully when used
    // This allows the app to run without Supabase configured
    const createMockQuery = () => {
      const result = {
        data: null,
        error: { message: "Supabase not configured" },
      };

      const mockQuery: any = Object.assign(Promise.resolve(result), {
        select: () => mockQuery,
        eq: () => mockQuery,
        single: () => Promise.resolve(result),
        order: () => mockQuery,
        insert: () => Promise.resolve(result),
        update: () => Promise.resolve(result),
        delete: () => Promise.resolve(result),
        upsert: () => Promise.resolve(result),
        is: () => mockQuery,
        limit: () => mockQuery,
        range: () => mockQuery,
      });

      return mockQuery;
    };

    return {
      from: () => createMockQuery(),
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signIn: () =>
          Promise.resolve({
            data: { user: null },
            error: { message: "Supabase not configured" },
          }),
        signOut: () => Promise.resolve({ error: null }),
      },
      storage: {
        from: () => ({
          upload: () =>
            Promise.resolve({
              data: null,
              error: { message: "Supabase not configured" },
            }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
    } as any;
  }

  // Only call cookies() if we have Supabase configured and we're in a valid context
  try {
    // Dynamically import cookies to avoid errors in API routes
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    return createServerClient(env.url, env.anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    });
  } catch (error) {
    // If cookies() fails (e.g., called in wrong context), return mock client
    console.error("Failed to create Supabase client:", error);
    const createMockQueryFallback = () => {
      const result = {
        data: null,
        error: { message: "Supabase client creation failed" },
      };

      const mockQueryFallback: any = Object.assign(Promise.resolve(result), {
        select: () => mockQueryFallback,
        eq: () => mockQueryFallback,
        single: () => Promise.resolve(result),
        order: () => mockQueryFallback,
        insert: () => Promise.resolve(result),
        update: () => Promise.resolve(result),
        delete: () => Promise.resolve(result),
        upsert: () => Promise.resolve(result),
        is: () => mockQueryFallback,
        limit: () => mockQueryFallback,
        range: () => mockQueryFallback,
      });

      return mockQueryFallback;
    };

    return {
      from: () => createMockQueryFallback(),
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signIn: () =>
          Promise.resolve({
            data: { user: null },
            error: { message: "Supabase not configured" },
          }),
        signOut: () => Promise.resolve({ error: null }),
      },
      storage: {
        from: () => ({
          upload: () =>
            Promise.resolve({
              data: null,
              error: { message: "Supabase not configured" },
            }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
    } as any;
  }
}
