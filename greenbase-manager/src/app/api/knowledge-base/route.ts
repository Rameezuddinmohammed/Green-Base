import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Knowledge Base API called')
    
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
    
    console.log('🔐 Getting session...')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError)
      return NextResponse.json({ error: 'Session error', details: sessionError.message }, { status: 401 })
    }
    
    if (!session?.user?.id) {
      console.log('❌ No session found in knowledge base API')
      console.log('Session details:', { 
        hasSession: !!session, 
        hasUser: !!session?.user, 
        userId: session?.user?.id,
        userEmail: session?.user?.email 
      })
      
      // Get all cookies for debugging
      const allCookies = cookieStore.getAll()
      const authCookies = allCookies.filter(c => 
        c.name.includes('supabase') || c.name.includes('sb-') || c.name.includes('auth')
      )
      
      return NextResponse.json({ 
        error: 'Unauthorized - No valid session found',
        debug: {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id || null,
          userEmail: session?.user?.email || null,
          cookieCount: allCookies.length,
          authCookieCount: authCookies.length,
          authCookieNames: authCookies.map(c => c.name)
        }
      }, { status: 401 })
    }

    console.log('👤 Knowledge base request from user:', session.user.id, session.user.email)

    console.log('🔧 Initializing Supabase admin client...')
    let supabaseAdmin
    try {
      supabaseAdmin = await getSupabaseAdmin()
      console.log('✅ Supabase admin client initialized')
    } catch (adminError: any) {
      console.error('❌ Failed to initialize Supabase admin:', adminError)
      return NextResponse.json({ 
        error: 'Failed to initialize admin client', 
        details: adminError.message,
        stack: adminError.stack
      }, { status: 500 })
    }
    
    console.log('🔍 Looking up user in database...')
    
    // Get user's organization - try by ID first, then by email
    let { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', session.user.id)
      .single()

    if (userError && session.user.email) {
      console.log('🔄 User not found by ID, trying email:', session.user.email)
      const { data: userByEmail, error: userByEmailError } = await supabaseAdmin
        .from('users')
        .select('organization_id, role')
        .eq('email', session.user.email)
        .single()
      
      user = userByEmail
      userError = userByEmailError
    }

    if (userError || !user) {
      console.error('❌ User not found in database:', userError?.message)
      console.log('Available users check...')
      
      // Debug: Check what users exist
      const { data: allUsers } = await supabaseAdmin
        .from('users')
        .select('id, email, organization_id')
        .limit(10)
      
      console.log('Available users:', allUsers)
      
      return NextResponse.json({ 
        error: 'User not found', 
        details: userError?.message,
        debug: {
          sessionUserId: session.user.id,
          sessionUserEmail: session.user.email,
          availableUsers: allUsers?.map(u => ({ id: u.id, email: u.email }))
        }
      }, { status: 404 })
    }

    console.log('✅ Found user:', { id: session.user.id, org: user.organization_id, role: user.role })

    console.log('📚 Querying approved documents...')
    
    // Get approved documents for the organization with user information
    const { data: documents, error: documentsError } = await supabaseAdmin
      .from('approved_documents')
      .select(`
        *,
        approver:users!approved_by(email)
      `)
      .eq('organization_id', user.organization_id)
      .order('updated_at', { ascending: false })
    
    // Filter out archived documents in JavaScript (safer than PostgreSQL array operators)
    const filteredDocuments = documents?.filter(doc => 
      !doc.tags || !doc.tags.includes('archived')
    ) || []

    if (documentsError) {
      console.error('❌ Documents query error:', documentsError)
      return NextResponse.json({ 
        error: 'Failed to query documents', 
        details: documentsError.message 
      }, { status: 500 })
    }

    console.log(`📚 Found ${documents?.length || 0} total documents, ${filteredDocuments.length} non-archived for organization ${user.organization_id}`)
    
    return NextResponse.json({ documents: filteredDocuments })
  } catch (error: any) {
    console.error('❌ Knowledge base API error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: 'Failed to get knowledge base documents', 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}

