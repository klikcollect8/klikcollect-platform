import { createBrowserClient } from '@supabase/ssr'

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    console.error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    )
    return null
  }

  return { url, anon }
}

export function createClient() {
  const env = getSupabaseEnv()
  if (!env) {
    // Return a mock client that will fail gracefully when used
    // This allows the app to run without Supabase configured
    const mockQuery = {
      data: null,
      error: { message: 'Supabase not configured' },
      select: () => mockQuery,
      eq: () => mockQuery,
      single: () => Promise.resolve(mockQuery),
      order: () => mockQuery,
      insert: () => Promise.resolve(mockQuery),
      update: () => Promise.resolve(mockQuery),
      delete: () => Promise.resolve(mockQuery),
      upsert: () => Promise.resolve(mockQuery),
      is: () => mockQuery,
    }
    
    return {
      from: () => mockQuery,
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signIn: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
        signInWithPassword: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
        signInWithOAuth: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
        signUp: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
        signOut: () => Promise.resolve({ error: null }),
      },
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
    } as any
  }

  return createBrowserClient(env.url, env.anon)
}
