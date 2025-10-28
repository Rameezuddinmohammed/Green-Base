import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    let userProfile = null
    if (session?.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      userProfile = profile
    }

    return NextResponse.json({
      authenticated: !!session,
      session: session ? {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: session.expires_at
      } : null,
      profile: userProfile,
      cookies: cookieStore.getAll().map(c => ({ 
        name: c.name, 
        hasValue: !!c.value,
        length: c.value?.length || 0
      })),
      error: sessionError?.message,
      debug: {
        cookieCount: cookieStore.getAll().length,
        supabaseCookies: cookieStore.getAll().filter(c => c.name.includes('supabase')).length
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Failed to check auth status', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}