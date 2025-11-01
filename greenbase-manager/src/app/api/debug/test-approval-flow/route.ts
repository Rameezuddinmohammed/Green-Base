import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing approval flow...')
    
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
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user info
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, organization_id, role')
      .eq('id', session.user.id)
      .single()

    if (!user && session.user.email) {
      const { data: userByEmail } = await supabaseAdmin
        .from('users')
        .select('id, email, organization_id, role')
        .eq('email', session.user.email)
        .single()
      user = userByEmail
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get pending drafts for this user's organization
    const { data: pendingDrafts } = await supabaseAdmin
      .from('draft_documents')
      .select('id, title, status, organization_id')
      .eq('organization_id', user.organization_id)
      .eq('status', 'pending')

    // Get approved documents for this user's organization
    const { data: approvedDocs } = await supabaseAdmin
      .from('approved_documents')
      .select('id, title, organization_id, approved_by, created_at')
      .eq('organization_id', user.organization_id)
      .order('created_at', { ascending: false })

    // Test knowledge base API
    let kbApiResult = null
    try {
      const kbResponse = await fetch(`${request.nextUrl.origin}/api/knowledge-base`, {
        headers: {
          'Cookie': request.headers.get('Cookie') || ''
        }
      })
      kbApiResult = {
        status: kbResponse.status,
        ok: kbResponse.ok,
        data: kbResponse.ok ? await kbResponse.json() : await kbResponse.text()
      }
    } catch (error: any) {
      kbApiResult = {
        error: error.message
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        organization_id: user.organization_id,
        role: user.role
      },
      session: {
        userId: session.user.id,
        email: session.user.email
      },
      pendingDrafts: {
        count: pendingDrafts?.length || 0,
        drafts: pendingDrafts || []
      },
      approvedDocs: {
        count: approvedDocs?.length || 0,
        docs: approvedDocs || []
      },
      knowledgeBaseApi: kbApiResult
    })

  } catch (error: any) {
    console.error('❌ Test approval flow error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to test approval flow', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}