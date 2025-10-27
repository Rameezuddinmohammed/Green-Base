import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
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
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      // For testing without authentication, return empty drafts
      console.log('No session found, returning empty drafts for demo')
      return NextResponse.json({ drafts: [] })
    }

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user info
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, organization_id, role')
      .eq('email', session.user.email)
      .single()

    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 })
    }

    // Fetch all pending draft documents for the organization
    const { data: drafts, error } = await supabaseAdmin
      .from('draft_documents')
      .select(`
        id,
        title,
        content,
        summary,
        topics,
        confidence_score,
        triage_level,
        created_at,
        source_references,
        status
      `)
      .eq('organization_id', user.organization_id)
      .eq('status', 'pending')
      .order('confidence_score', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ drafts: drafts || [] })
  } catch (error: any) {
    console.error('Get drafts error:', error)
    return NextResponse.json(
      { error: 'Failed to get draft documents', details: error.message },
      { status: 500 }
    )
  }
}

