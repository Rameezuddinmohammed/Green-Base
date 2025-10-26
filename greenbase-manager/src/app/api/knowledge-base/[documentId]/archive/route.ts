import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { getServerSession } from 'next-auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await params

    const supabase = await getSupabaseAdmin()
    
    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('email', session.user.email)
      .single()

    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 })
    }

    // Get current document to append archived tag
    const { data: currentDoc } = await supabase
      .from('approved_documents')
      .select('tags')
      .eq('id', documentId)
      .eq('organization_id', user.organization_id)
      .single()

    const currentTags = currentDoc?.tags || []
    const updatedTags = currentTags.includes('archived') 
      ? currentTags 
      : [...currentTags, 'archived']

    // Archive document (soft delete by adding archived flag)
    const { error } = await supabase
      .from('approved_documents')
      .update({ 
        updated_at: new Date().toISOString(),
        tags: updatedTags
      })
      .eq('id', documentId)
      .eq('organization_id', user.organization_id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Archive document error:', error)
    return NextResponse.json(
      { error: 'Failed to archive document', details: error.message },
      { status: 500 }
    )
  }
}