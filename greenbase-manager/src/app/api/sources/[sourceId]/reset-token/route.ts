import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  console.log('🔄 Reset change token endpoint called')
  
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { sourceId } = await params
    const adminSupabase = await getSupabaseAdmin()

    // Reset the change token to null to force full sync
    const { error } = await adminSupabase
      .from('connected_sources')
      .update({ 
        change_token: null,
        last_sync_at: null 
      })
      .eq('id', sourceId)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('❌ Failed to reset change token:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to reset change token',
        details: error.message
      }, { status: 500 })
    }

    console.log('✅ Change token reset successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Change token reset successfully. Next sync will be a full sync.',
      sourceId,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ Reset token API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to reset change token',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}