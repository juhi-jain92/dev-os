import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Route protection per docs/specs/auth-spec.md — unauthenticated requests to
// /dashboard, /upload, or /contracts/* redirect to /sign-in. Authenticated
// requests to /sign-in or /sign-up redirect to /dashboard (security-foundation §1).
const PROTECTED_PATHS = ['/dashboard', '/upload', '/contracts']
const AUTH_PATHS = ['/sign-in', '/sign-up']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )
  const isAuthPath = AUTH_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )
  if (!isProtected && !isAuthPath) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/upload/:path*', '/contracts/:path*', '/sign-in', '/sign-up'],
}
