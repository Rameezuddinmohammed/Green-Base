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

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    let userProfile = null
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      
      userProfile = profile
    }

    return NextResponse.json({
      authenticated: !!user,
      session: user ? {
        userId: user.id,
        email: user.email,
        expiresAt: null // getUser doesn't provide session expiry
      } : null,
      profile: userProfile,
      cookies: cookieStore.getAll().map(c => ({ 
        name: c.name, 
        hasValue: !!c.value,
        length: c.value?.length || 0
      })),
      error: userError?.message,
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