import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  })

  const env = getSupabaseEnv()
  if (!env) {
    // Return response without Supabase session update if config is missing
    // This allows the app to run without Supabase configured
    return supabaseResponse
  }

  try {
    const supabase = createServerClient(
      env.url,
      env.anon,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              supabaseResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // IMPORTANT: Always call getUser() to refresh the session token
    // This is required for Server Components and ensures auth cookies stay valid
    // Do NOT gate this behind getSession() - it must run unconditionally
    await supabase.auth.getUser()
  } catch (error) {
    // If Supabase fails, just continue without session update
    // Don't log errors for missing sessions (normal for unauthenticated users)
    if (error instanceof Error && !error.message.includes('session')) {
      console.error('Supabase session update failed:', error)
    }
  }

  return supabaseResponse
}
