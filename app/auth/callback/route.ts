import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeRedirectPath } from '@/lib/fitness'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (code) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(new URL(safeRedirectPath(url.searchParams.get('next')), url.origin))
    } catch { /* Expired links and connection failures use the same recoverable screen. */ }
  }
  return NextResponse.redirect(new URL('/?auth_error=confirmation', url.origin))
}
