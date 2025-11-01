import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Knowledge Base Authentication...')
    
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
    
    // Test session
    console.log('1️⃣ Testing session...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      return NextResponse.json({
        success: false,
        step: 'session',
        error: sessionError.message,
        details: sessionError
      }, { status: 401 })
    }
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        step: 'session',
        error: 'No session found',
        cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
      }, { status: 401 })
    }

    console.log('✅ Session found:', session.user.id, session.user.email)

    // Test user lookup
    console.log('2️⃣ Testing user lookup...')
    const supabaseAdmin = await getSupabaseAdmin()
    
    let { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', session.user.id)
      .single()

    if (userError && session.user.email) {
      console.log('🔄 User not found by ID, trying email:', session.user.email)
      const { data: userByEmail, error: userByEmailError } = await supabaseAdmin
        .from('users')
        .select('id, email, organization_id, role')
        .eq('email', session.user.email)
        .single()
      
      user = userByEmail
      userError = userByEmailError
    }

    if (userError || !user) {
      // Get all users for debugging
      const { data: allUsers } = await supabaseAdmin
        .from('users')
        .select('id, email, organization_id')
        .limit(10)
      
      return NextResponse.json({
        success: false,
        step: 'user_lookup',
        error: userError?.message || 'User not found',
        debug: {
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email,
          availableUsers: allUsers?.map(u => ({ id: u.id, email: u.email }))
        }
      }, { status: 404 })
    }

    console.log('✅ User found:', user)

    // Test documents query
    console.log('3️⃣ Testing documents query...')
    const { data: documents, error: documentsError } = await supabaseAdmin
      .from('approved_documents')
      .select('id, title, organization_id, created_at')
      .eq('organization_id', user.organization_id)
      .limit(5)

    if (documentsError) {
      return NextResponse.json({
        success: false,
        step: 'documents_query',
        error: documentsError.message,
        details: documentsError
      }, { status: 500 })
    }

    console.log('✅ Documents query successful')

    return NextResponse.json({
      success: true,
      message: 'Knowledge Base authentication test passed',
      results: {
        session: {
          userId: session.user.id,
          email: session.user.email,
          expiresAt: session.expires_at
        },
        user: {
          id: user.id,
          email: user.email,
          organizationId: user.organization_id,
          role: user.role
        },
        documents: {
          count: documents?.length || 0,
          organizationId: user.organization_id
        }
      }
    })

  } catch (error: any) {
    console.error('❌ KB Auth test failed:', error)
    return NextResponse.json({
      success: false,
      step: 'unknown',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}