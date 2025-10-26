import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { getServerSession } from 'next-auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await getSupabaseAdmin()
    
    // Get user's organization
    const { data: user } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Use the database function to get stats
    const { data: statsData, error } = await supabase
      .rpc('get_document_stats', { org_id: user.organization_id })

    if (error) {
      throw error
    }

    const stats = statsData && statsData.length > 0 ? statsData[0] : {
      total_approved_documents: 0,
      total_draft_documents: 0,
      pending_approvals: 0,
      total_qa_interactions: 0,
      avg_confidence_score: 0
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('Get analytics stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get analytics stats', details: error.message },
      { status: 500 }
    )
  }
}

