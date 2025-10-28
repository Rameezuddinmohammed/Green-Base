import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'

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
      // Return empty sources for unauthenticated users
      console.log('No session found, returning empty sources')
      return NextResponse.json({ sources: [] })
    }

    // Get sources directly from database
    const supabaseAdmin = await getSupabaseAdmin()
    const { data: sources, error } = await supabaseAdmin
      .from('connected_sources')
      .select('id, type, name, user_id, selected_channels, selected_folders, selected_team_channels, last_sync_at, is_active, created_at')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error getting sources:', error)
      return NextResponse.json(
        { error: 'Failed to get connected sources', details: error.message },
        { status: 500 }
      )
    }

    // Transform to match expected format
    const transformedSources = sources.map(source => ({
      id: source.id,
      type: source.type,
      name: source.name,
      userId: source.user_id,
      selectedChannels: source.selected_channels || undefined,
      selectedFolders: source.selected_folders || undefined,
      selectedTeamChannels: source.selected_team_channels || undefined,
      lastSyncAt: source.last_sync_at ? new Date(source.last_sync_at) : undefined,
      isActive: source.is_active
    }))

    return NextResponse.json({ sources: transformedSources })
  } catch (error: any) {
    console.error('Get sources error:', error)
    return NextResponse.json(
      { error: 'Failed to get connected sources', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 })
    }

    // Disconnect source directly in database
    const supabaseAdmin = await getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('connected_sources')
      .update({ is_active: false })
      .eq('id', sourceId)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Database error disconnecting source:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect source', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Disconnect source error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect source', details: error.message },
      { status: 500 }
    )
  }
}

