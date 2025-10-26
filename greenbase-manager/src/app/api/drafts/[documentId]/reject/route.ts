import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> }
) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { documentId } = await params

        const supabaseAdmin = await getSupabaseAdmin()

        // Get user info
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('organization_id, role')
            .eq('email', session.user.email)
            .single()

        if (!user || user.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 })
        }

        // Update draft document status
        const { error } = await supabaseAdmin
            .from('draft_documents')
            .update({ status: 'rejected' })
            .eq('id', documentId)
            .eq('organization_id', user.organization_id)

        if (error) {
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Reject document error:', error)
        return NextResponse.json(
            { error: 'Failed to reject document', details: error.message },
            { status: 500 }
        )
    }
}