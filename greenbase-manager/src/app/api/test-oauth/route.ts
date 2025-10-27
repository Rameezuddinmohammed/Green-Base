import { NextRequest, NextResponse } from 'next/server'
import { getConfigService } from '../../../lib/config'
import { getMicrosoftGraphService } from '../../../lib/oauth/microsoft-graph'
import { getGoogleDriveService } from '../../../lib/oauth/google-drive'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider') as 'microsoft' | 'google'
    
    if (!provider || !['microsoft', 'google'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider. Use microsoft or google' }, { status: 400 })
    }

    // Test configuration loading
    const configService = getConfigService()
    const config = await configService.getConfig()
    
    const testResults = {
      provider,
      configLoaded: true,
      credentials: {
        microsoft: {
          clientId: config.oauth.microsoft.clientId ? '✓ Set' : '✗ Missing',
          clientSecret: config.oauth.microsoft.clientSecret ? '✓ Set' : '✗ Missing',
          tenantId: config.azure.tenantId ? '✓ Set' : '✗ Missing'
        },
        google: {
          clientId: config.oauth.google.clientId ? '✓ Set' : '✗ Missing',
          clientSecret: config.oauth.google.clientSecret ? '✓ Set' : '✗ Missing'
        }
      },
      authUrlGeneration: 'Not tested'
    }

    // Test auth URL generation
    try {
      if (provider === 'microsoft') {
        const microsoftService = getMicrosoftGraphService()
        const authUrl = await microsoftService.getAuthUrl('test-user-id')
        testResults.authUrlGeneration = authUrl ? '✓ Success' : '✗ Failed'
      } else if (provider === 'google') {
        const googleService = getGoogleDriveService()
        const authUrl = await googleService.getAuthUrl('test-user-id')
        testResults.authUrlGeneration = authUrl ? '✓ Success' : '✗ Failed'
      }
    } catch (error) {
      testResults.authUrlGeneration = `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }

    return NextResponse.json(testResults)
  } catch (error: any) {
    console.error('OAuth test error:', error)
    return NextResponse.json(
      { 
        error: 'OAuth test failed', 
        details: error.message,
        configLoaded: false
      },
      { status: 500 }
    )
  }
}