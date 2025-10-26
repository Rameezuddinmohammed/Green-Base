import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

