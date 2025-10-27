import { NextRequest, NextResponse } from 'next/server'
import { getDemoStorage } from '../../../lib/demo-storage'

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json()
    
    const demoStorage = getDemoStorage()
    
    const demoSource = {
      id: `demo-${provider}-${Date.now()}`,
      type: provider === 'microsoft' ? 'teams' as const : 'google_drive' as const,
      name: provider === 'microsoft' ? `Microsoft Teams - Demo` : `Google Drive - Demo`,
      userId: 'demo-user',
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      selectedChannels: provider === 'microsoft' ? ['demo-channel-1'] : undefined,
      selectedFolders: provider === 'google' ? ['demo-folder-1'] : undefined,
      isActive: true,
      lastSyncAt: new Date()
    }
    
    demoStorage.addSource(demoSource)
    demoStorage.listAll() // Debug output
    
    return NextResponse.json({ 
      success: true, 
      source: demoSource,
      message: `Demo ${provider} source created successfully`
    })
  } catch (error: any) {
    console.error('Create demo source error:', error)
    return NextResponse.json(
      { error: 'Failed to create demo source', details: error.message },
      { status: 500 }
    )
  }
}