import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Database } from '@/types/database'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()
  
  // Debug logging
  console.log('Middleware - Path:', req.nextUrl.pathname)
  console.log('Middleware - Session exists:', !!session)
  if (session) {
    console.log('Middleware - User ID:', session.user.id)
  }



  // Skip middleware for API routes (including OAuth)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return response
  }

  // TEMPORARILY DISABLED PROTECTION FOR DEBUGGING
  // TODO: Re-enable after fixing session detection
  
  // Define protected routes
  const protectedRoutes = ['/dashboard/approvals', '/dashboard/sources', '/dashboard/knowledge-base']
  const authRoutes = ['/auth/signin', '/auth/signup']

  const isAuthRoute = authRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )

  // Only redirect authenticated users away from auth pages
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // TEMPORARILY DISABLED: Route protection
  // This allows access to all dashboard routes without authentication
  // so we can test the OAuth flow and other functionality

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}