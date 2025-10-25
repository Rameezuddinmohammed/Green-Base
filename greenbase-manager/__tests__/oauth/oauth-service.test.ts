import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Set up environment variables for testing
process.env.AZURE_KEY_VAULT_URL = 'https://test-vault.vault.azure.net/'
process.env.AZURE_CLIENT_ID = 'test-client-id'
process.env.AZURE_CLIENT_SECRET = 'test-client-secret'
process.env.AZURE_TENANT_ID = 'test-tenant-id'

// Mock the dependencies
jest.mock('../../src/lib/config')
jest.mock('../../src/lib/azure-keyvault')
jest.mock('@supabase/supabase-js')

import { getOAuthService } from '../../src/lib/oauth/oauth-service'

describe('OAuthService', () => {
  let oauthService: any

  beforeEach(() => {
    oauthService = getOAuthService()
    jest.clearAllMocks()
  })

  describe('getAuthUrl', () => {
    it('should generate Microsoft auth URL', async () => {
      const mockMicrosoftService = {
        getAuthUrl: jest.fn().mockResolvedValue('https://login.microsoftonline.com/oauth2/authorize?...')
      }
      
      // Mock the Microsoft service
      oauthService.microsoftService = mockMicrosoftService
      
      const authUrl = await oauthService.getAuthUrl('microsoft', 'user123')
      
      expect(mockMicrosoftService.getAuthUrl).toHaveBeenCalledWith('user123')
      expect(authUrl).toBe('https://login.microsoftonline.com/oauth2/authorize?...')
    })

    it('should generate Google auth URL', async () => {
      const mockGoogleService = {
        getAuthUrl: jest.fn().mockResolvedValue('https://accounts.google.com/oauth2/auth?...')
      }
      
      // Mock the Google service
      oauthService.googleService = mockGoogleService
      
      const authUrl = await oauthService.getAuthUrl('google', 'user123')
      
      expect(mockGoogleService.getAuthUrl).toHaveBeenCalledWith('user123')
      expect(authUrl).toBe('https://accounts.google.com/oauth2/auth?...')
    })

    it('should throw error for unsupported provider', async () => {
      await expect(oauthService.getAuthUrl('unsupported' as any, 'user123'))
        .rejects.toThrow('Unsupported provider: unsupported')
    })
  })

  describe('handleCallback', () => {
    it('should handle Microsoft callback successfully with Key Vault storage', async () => {
      const mockTokens = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresAt: new Date(),
        scopes: ['scope1', 'scope2']
      }

      const mockMicrosoftService = {
        exchangeCodeForTokens: jest.fn().mockResolvedValue(mockTokens)
      }

      const mockKeyVaultService = {
        storeOAuthTokens: jest.fn().mockResolvedValue(undefined)
      }

      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'source123',
            user_id: 'user123',
            type: 'teams',
            name: 'Microsoft Teams',
            // SECURITY: No access_token or refresh_token in database
            is_active: true,
            selected_channels: null,
            selected_folders: null,
            last_sync_at: null
          },
          error: null
        })
      }

      oauthService.microsoftService = mockMicrosoftService
      oauthService.keyVaultService = mockKeyVaultService
      oauthService.supabase = mockSupabase

      const result = await oauthService.handleCallback('microsoft', 'auth_code_123', 'user123', 'Microsoft Teams')

      expect(mockMicrosoftService.exchangeCodeForTokens).toHaveBeenCalledWith('auth_code_123', 'user123')
      expect(mockKeyVaultService.storeOAuthTokens).toHaveBeenCalledWith('user123', 'microsoft', 'access_token_123', 'refresh_token_123')
      expect(mockSupabase.from).toHaveBeenCalledWith('connected_sources')
      expect(result).toEqual({
        id: 'source123',
        type: 'teams',
        name: 'Microsoft Teams',
        userId: 'user123',
        accessToken: 'access_token_123', // Returned for immediate use
        refreshToken: 'refresh_token_123', // Returned for immediate use
        isActive: true
      })
    })
  })
})