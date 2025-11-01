import { NextRequest, NextResponse } from 'next/server'
import { getSyncScheduler } from '../../../../lib/background/sync-scheduler'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Manual trigger for automatic sync (for testing and admin use)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body

    // Allow starting scheduler without authentication for app initialization
    if (action === 'start') {
      console.log('🚀 Starting automatic sync scheduler...')
      
      const scheduler = getSyncScheduler()
      
      if (scheduler.isSchedulerRunning()) {
        return NextResponse.json({
          success: true,
          message: 'Scheduler is already running',
          status: 'already_running'
        })
      }
      
      // Start with 5-minute check intervals (will respect individual source frequencies)
      scheduler.start(5)
      
      return NextResponse.json({
        success: true,
        message: 'Automatic sync scheduler started successfully',
        status: 'started',
        checkInterval: '5 minutes'
      })
    }

    // For other actions, require authentication
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

    // Check if user is a manager (only managers can trigger sync)
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!user || user.role !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    console.log(`🔧 Manual sync trigger requested by ${session.user.email}`)

    const scheduler = getSyncScheduler()
    
    if (action === 'stop') {
      scheduler.stop()
      return NextResponse.json({
        success: true,
        message: 'Scheduler stopped successfully',
        stoppedBy: session.user.email
      })
    }
    
    // Default action: trigger manual check
    await scheduler.triggerManualCheck()

    return NextResponse.json({
      success: true,
      message: 'Automatic sync triggered successfully',
      triggeredBy: session.user.email,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Failed to trigger sync action:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to trigger sync',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Get sync scheduler status
 */
export async function GET() {
  try {
    const scheduler = getSyncScheduler()
    
    return NextResponse.json({
      success: true,
      isRunning: scheduler.isSchedulerRunning(),
      status: scheduler.isSchedulerRunning() ? 'active' : 'stopped'
    })

  } catch (error: any) {
    console.error('Failed to get scheduler status:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get status',
      details: error.message
    }, { status: 500 })
  }
}