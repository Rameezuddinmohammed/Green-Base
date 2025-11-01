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

  // Get authenticated user - more secure than getSession()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  // Debug logging (disabled for cleaner terminal)
  // console.log('Middleware - Path:', req.nextUrl.pathname)
  // console.log('Middleware - User exists:', !!user)
  // console.log('Middleware - Auth error:', error?.message || 'none')
  // if (user) {
  //   console.log('Middleware - User ID:', user.id)
  // }



  // Skip middleware for API routes (including OAuth)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return response
  }

  // Define protected routes
  const protectedRoutes = ['/dashboard']
  const authRoutes = ['/auth/signin', '/auth/signup']

  const isProtectedRoute = protectedRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.some(route => 
    req.nextUrl.pathname.startsWith(route)
  )

  // Redirect authenticated users away from auth pages
  if (user && isAuthRoute) {
    // console.log('Authenticated user accessing auth page, redirecting to dashboard')
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Protect dashboard routes - require authentication
  if (isProtectedRoute && !user) {
    // console.log('Unauthenticated user accessing protected route, redirecting to signin')
    const redirectUrl = new URL('/auth/signin', req.url)
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

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