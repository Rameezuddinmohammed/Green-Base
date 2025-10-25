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

describe('OAuth Security Compliance', () => {
  let oauthService: any

  beforeEach(() => {
    oauthService = getOAuthService()
    jest.clearAllMocks()
  })

  describe('Token Storage Security', () => {
    it('should NEVER store tokens in database during handleCallback', async () => {
      const mockTokens = {
        accessToken: 'secret_access_token',
        refreshToken: 'secret_refresh_token',
        expiresAt: new Date(),
        scopes: ['scope1']
      }

      const mockMicrosoftService = {
        exchangeCodeForTokens: jest.fn().mockResolvedValue(mockTokens)
      }

      const mockKeyVaultService = {
        storeOAuthTokens: jest.fn().mockResolvedValue(undefined)
      }

      const mockSupabaseInsert = jest.fn().mockReturnThis()
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        insert: mockSupabaseInsert,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'source123', user_id: 'user123', type: 'teams', name: 'Test', is_active: true },
          error: null
        })
      }

      oauthService.microsoftService = mockMicrosoftService
      oauthService.keyVaultService = mockKeyVaultService
      oauthService.supabase = mockSupabase

      await oauthService.handleCallback('microsoft', 'auth_code', 'user123', 'Test Source')

      // SECURITY CHECK: Verify tokens are stored in Key Vault
      expect(mockKeyVaultService.storeOAuthTokens).toHaveBeenCalledWith(
        'user123', 
        'microsoft', 
        'secret_access_token', 
        'secret_refresh_token'
      )

      // SECURITY CHECK: Verify database insert does NOT contain tokens
      const insertCall = mockSupabaseInsert.mock.calls[0][0]
      expect(insertCall).not.toHaveProperty('access_token')
      expect(insertCall).not.toHaveProperty('refresh_token')
      expect(insertCall).toEqual({
        user_id: 'user123',
        type: 'teams',
        name: 'Test Source',
        is_active: true
      })
    })

    it('should retrieve tokens from Key Vault when getting connected sources', async () => {
      const mockKeyVaultService = {
        getOAuthTokens: jest.fn().mockResolvedValue({
          accessToken: 'vault_access_token',
          refreshToken: 'vault_refresh_token'
        })
      }

      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      }

      // Mock the chained calls properly
      const mockChain = {
        eq: jest.fn().mockResolvedValue({
          data: [{
            id: 'source123',
            type: 'teams',
            name: 'Test Source',
            user_id: 'user123',
            is_active: true,
            selected_channels: null,
            selected_folders: null,
            last_sync_at: null
          }],
          error: null
        })
      }

      mockSupabase.eq = jest.fn().mockReturnValue(mockChain)

      oauthService.keyVaultService = mockKeyVaultService
      oauthService.supabase = mockSupabase

      const sources = await oauthService.getConnectedSources('user123')

      // SECURITY CHECK: Verify tokens retrieved from Key Vault
      expect(mockKeyVaultService.getOAuthTokens).toHaveBeenCalledWith('user123', 'microsoft')
      
      // SECURITY CHECK: Verify database query excludes token columns
      expect(mockSupabase.select).toHaveBeenCalledWith(
        'id, type, name, user_id, selected_channels, selected_folders, selected_team_channels, last_sync_at, is_active'
      )

      // Verify tokens are included in response (from Key Vault)
      expect(sources[0]).toEqual({
        id: 'source123',
        type: 'teams',
        name: 'Test Source',
        userId: 'user123',
        accessToken: 'vault_access_token',
        refreshToken: 'vault_refresh_token',
        isActive: true
      })
    })

    it('should delete tokens from Key Vault when disconnecting source', async () => {
      const mockKeyVaultService = {
        deleteOAuthTokens: jest.fn().mockResolvedValue(undefined)
      }

      const mockMicrosoftService = {
        revokeTokens: jest.fn().mockResolvedValue(undefined)
      }

      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'source123', type: 'teams', user_id: 'user123', is_active: true },
          error: null
        }),
        update: jest.fn().mockReturnThis()
      }

      // Mock the chained calls for select query
      const mockSelectChain = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'source123', type: 'teams', user_id: 'user123', is_active: true },
          error: null
        })
      }

      // Mock the chained calls for update query
      const mockUpdateChain = {
        eq: jest.fn().mockResolvedValue({ error: null })
      }

      mockSupabase.eq = jest.fn()
        .mockReturnValueOnce(mockSelectChain) // First call for select
        .mockReturnValueOnce(mockUpdateChain) // Second call for update

      oauthService.keyVaultService = mockKeyVaultService
      oauthService.microsoftService = mockMicrosoftService
      oauthService.supabase = mockSupabase

      await oauthService.disconnectSource('user123', 'source123')

      // SECURITY CHECK: Verify tokens deleted from Key Vault
      expect(mockKeyVaultService.deleteOAuthTokens).toHaveBeenCalledWith('user123', 'microsoft')
      
      // SECURITY CHECK: Verify provider tokens revoked
      expect(mockMicrosoftService.revokeTokens).toHaveBeenCalledWith('user123')
    })
  })

  describe('Database Query Security', () => {
    it('should never select token columns from database', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'source123', type: 'teams', user_id: 'user123' },
          error: null
        })
      }

      const mockKeyVaultService = {
        getOAuthTokens: jest.fn().mockResolvedValue({
          accessToken: 'token',
          refreshToken: 'refresh'
        })
      }

      const mockMicrosoftService = {
        getTeamsChannels: jest.fn().mockResolvedValue([])
      }

      // Mock the chained calls properly
      const mockChain = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'source123', type: 'teams', user_id: 'user123' },
          error: null
        })
      }

      mockSupabase.eq = jest.fn().mockReturnValue(mockChain)

      oauthService.supabase = mockSupabase
      oauthService.keyVaultService = mockKeyVaultService
      oauthService.microsoftService = mockMicrosoftService

      await oauthService.getTeamsChannels('user123', 'source123')

      // SECURITY CHECK: Verify select statement excludes token columns
      expect(mockSupabase.select).toHaveBeenCalledWith(
        'id, type, name, user_id, is_active'
      )
      expect(mockSupabase.select).not.toHaveBeenCalledWith(expect.stringContaining('access_token'))
      expect(mockSupabase.select).not.toHaveBeenCalledWith(expect.stringContaining('refresh_token'))
    })
  })
})