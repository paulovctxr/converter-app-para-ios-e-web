import { getSupabaseConfig, hasSupabaseConfig } from './config'
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!hasSupabaseConfig()) return response
  const { url, key } = getSupabaseConfig()
  const supabase = createServerClient(
    url,
    key,
    {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  try { await supabase.auth.getUser() } catch { /* The client shows a recoverable connection error. */ }
  return response
}
