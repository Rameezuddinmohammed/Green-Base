import { getSupabaseAdmin } from '../supabase-admin'
import { getKeyVaultService } from '../azure-keyvault'
import { getMicrosoftGraphService } from './microsoft-graph'
import { getGoogleDriveService } from './google-drive'
import { ConnectedSource, OAuthTokens, OAuthError, TeamChannelMapping } from './types'

export class OAuthService {
  private supabase: any = null
  private keyVaultService = getKeyVaultService()
  private microsoftService = getMicrosoftGraphService()
  private googleService = getGoogleDriveService()

  async initialize() {
    if (this.supabase) return

    // SECURITY: Use server-only admin client for OAuth operations
    this.supabase = await getSupabaseAdmin()
  }

  /**
   * Get OAuth authorization URL for a provider
   */
  async getAuthUrl(provider: 'microsoft' | 'google', userId: string): Promise<string> {
    switch (provider) {
      case 'microsoft':
        return await this.microsoftService.getAuthUrl(userId)
      case 'google':
        return await this.googleService.getAuthUrl(userId)
      default:
        throw new OAuthError(`Unsupported provider: ${provider}`, 'UNSUPPORTED_PROVIDER')
    }
  }

  /**
   * Handle OAuth callback and store connection
   */
  async handleCallback(
    provider: 'microsoft' | 'google',
    code: string,
    userId: string,
    sourceName: string
  ): Promise<ConnectedSource> {
    await this.initialize()

    let tokens: OAuthTokens
    let sourceType: 'teams' | 'google_drive'

    // Exchange code for tokens
    switch (provider) {
      case 'microsoft':
        tokens = await this.microsoftService.exchangeCodeForTokens(code, userId)
        sourceType = 'teams'
        break
      case 'google':
        tokens = await this.googleService.exchangeCodeForTokens(code, userId)
        sourceType = 'google_drive'
        break
      default:
        throw new OAuthError(`Unsupported provider: ${provider}`, 'UNSUPPORTED_PROVIDER')
    }

    // SECURITY: Store tokens in Azure Key Vault ONLY - never in database
    await this.keyVaultService.storeOAuthTokens(userId, provider, tokens.accessToken, tokens.refreshToken)

    // Store connection metadata in database (NO TOKENS)
    const { data: connectedSource, error } = await this.supabase
      .from('connected_sources')
      .insert({
        user_id: userId,
        type: sourceType,
        name: sourceName,
        // REMOVED: access_token and refresh_token - stored in Key Vault only
        is_active: true
      })
      .select()
      .single()

    if (error) {
      throw new OAuthError(`Failed to store connected source: ${error.message}`, 'DATABASE_ERROR')
    }

    return {
      id: connectedSource.id,
      type: sourceType,
      name: connectedSource.name,
      userId: connectedSource.user_id,
      accessToken: tokens.accessToken, // Return for immediate use, but not stored in DB
      refreshToken: tokens.refreshToken, // Return for immediate use, but not stored in DB
      selectedChannels: connectedSource.selected_channels || undefined,
      selectedFolders: connectedSource.selected_folders || undefined,
      lastSyncAt: connectedSource.last_sync_at ? new Date(connectedSource.last_sync_at) : undefined,
      isActive: connectedSource.is_active
    }
  }

  /**
   * Get all connected sources for a user
   */
  async getConnectedSources(userId: string): Promise<ConnectedSource[]> {
    await this.initialize()

    // SECURITY: Only select metadata from database - tokens are in Key Vault
    const { data: sources, error } = await this.supabase
      .from('connected_sources')
      .select('id, type, name, user_id, selected_channels, selected_folders, selected_team_channels, last_sync_at, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) {
      throw new OAuthError(`Failed to get connected sources: ${error.message}`, 'DATABASE_ERROR')
    }

    // For each source, retrieve tokens from Key Vault
    const sourcesWithTokens = await Promise.all(
      sources.map(async (source: any) => {
        const provider = source.type === 'teams' ? 'microsoft' : 'google'
        const { accessToken, refreshToken } = await this.keyVaultService.getOAuthTokens(userId, provider)

        return {
          id: source.id,
          type: source.type,
          name: source.name,
          userId: source.user_id,
          accessToken: accessToken || '', // Retrieved from Key Vault
          refreshToken: refreshToken || '', // Retrieved from Key Vault
          selectedChannels: source.selected_channels || undefined,
          selectedFolders: source.selected_folders || undefined,
          selectedTeamChannels: source.selected_team_channels || undefined, // Team-channel mappings
          lastSyncAt: source.last_sync_at ? new Date(source.last_sync_at) : undefined,
          isActive: source.is_active
        }
      })
    )

    return sourcesWithTokens
  }

  /**
   * Get Teams channels for a connected Microsoft source
   */
  async getTeamsChannels(userId: string, sourceId: string) {
    await this.initialize()

    // SECURITY: Only select metadata from database - tokens are in Key Vault
    const { data: source, error } = await this.supabase
      .from('connected_sources')
      .select('id, type, name, user_id, is_active')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .eq('type', 'teams')
      .single()

    if (error || !source) {
      throw new OAuthError('Connected source not found or not a Teams source', 'SOURCE_NOT_FOUND')
    }

    // Retrieve tokens from Key Vault before calling Microsoft service
    const { accessToken, refreshToken } = await this.keyVaultService.getOAuthTokens(userId, 'microsoft')

    if (!accessToken || !refreshToken) {
      throw new OAuthError('No valid tokens found for Microsoft source', 'NO_TOKENS')
    }

    return await this.microsoftService.getTeamsChannels(userId)
  }

  /**
   * Get Google Drive folders for a connected Google source
   */
  async getDriveFolders(userId: string, sourceId: string, folderId?: string) {
    await this.initialize()

    // SECURITY: Only select metadata from database - tokens are in Key Vault
    const { data: source, error } = await this.supabase
      .from('connected_sources')
      .select('id, type, name, user_id, is_active')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .eq('type', 'google_drive')
      .single()

    if (error || !source) {
      throw new OAuthError('Connected source not found or not a Google Drive source', 'SOURCE_NOT_FOUND')
    }

    // Retrieve tokens from Key Vault before calling Google service
    const { accessToken, refreshToken } = await this.keyVaultService.getOAuthTokens(userId, 'google')

    if (!accessToken || !refreshToken) {
      throw new OAuthError('No valid tokens found for Google Drive source', 'NO_TOKENS')
    }

    return await this.googleService.getDriveItems(userId, folderId)
  }

  /**
   * Update selected channels/folders for a source
   */
  async updateSourceSelection(
    userId: string,
    sourceId: string,
    selectedChannels?: string[],
    selectedFolders?: string[],
    selectedTeamChannels?: TeamChannelMapping[]
  ): Promise<void> {
    await this.initialize()

    const updateData: any = {}
    if (selectedChannels !== undefined) {
      updateData.selected_channels = selectedChannels
    }
    if (selectedFolders !== undefined) {
      updateData.selected_folders = selectedFolders
    }
    if (selectedTeamChannels !== undefined) {
      updateData.selected_team_channels = selectedTeamChannels
    }

    const { error } = await this.supabase
      .from('connected_sources')
      .update(updateData)
      .eq('id', sourceId)
      .eq('user_id', userId)

    if (error) {
      throw new OAuthError(`Failed to update source selection: ${error.message}`, 'DATABASE_ERROR')
    }
  }

  /**
   * Update last sync timestamp for a source
   */
  async updateLastSync(userId: string, sourceId: string): Promise<void> {
    await this.initialize()

    const { error } = await this.supabase
      .from('connected_sources')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', sourceId)
      .eq('user_id', userId)

    if (error) {
      throw new OAuthError(`Failed to update last sync: ${error.message}`, 'DATABASE_ERROR')
    }
  }

  /**
   * Disconnect and revoke a source
   */
  async disconnectSource(userId: string, sourceId: string): Promise<void> {
    await this.initialize()

    // SECURITY: Only select metadata from database - tokens are in Key Vault
    const { data: source, error: fetchError } = await this.supabase
      .from('connected_sources')
      .select('id, type, name, user_id, is_active')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !source) {
      throw new OAuthError('Connected source not found', 'SOURCE_NOT_FOUND')
    }

    const provider = source.type === 'teams' ? 'microsoft' : 'google'

    // Revoke tokens with the provider
    try {
      switch (source.type) {
        case 'teams':
          await this.microsoftService.revokeTokens(userId)
          break
        case 'google_drive':
          await this.googleService.revokeTokens(userId)
          break
      }
    } catch (error) {
      console.warn(`Failed to revoke tokens for ${source.type}:`, error)
      // Continue with cleanup even if token revocation fails
    }

    // SECURITY: Delete tokens from Azure Key Vault
    try {
      await this.keyVaultService.deleteOAuthTokens(userId, provider)
    } catch (error) {
      console.warn(`Failed to delete tokens from Key Vault for ${provider}:`, error)
      // Continue with database cleanup even if Key Vault deletion fails
    }

    // Mark source as inactive in database
    const { error: updateError } = await this.supabase
      .from('connected_sources')
      .update({ is_active: false })
      .eq('id', sourceId)
      .eq('user_id', userId)

    if (updateError) {
      throw new OAuthError(`Failed to disconnect source: ${updateError.message}`, 'DATABASE_ERROR')
    }
  }

  /**
   * Refresh tokens for a source
   */
  async refreshSourceTokens(userId: string, sourceId: string): Promise<void> {
    await this.initialize()

    // SECURITY: Only select metadata from database - tokens are in Key Vault
    const { data: source, error: fetchError } = await this.supabase
      .from('connected_sources')
      .select('id, type, name, user_id, is_active')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !source) {
      throw new OAuthError('Connected source not found', 'SOURCE_NOT_FOUND')
    }

    const provider = source.type === 'teams' ? 'microsoft' : 'google'

    // Refresh tokens with the provider
    let tokens: OAuthTokens
    switch (source.type) {
      case 'teams':
        tokens = await this.microsoftService.refreshTokens(userId)
        break
      case 'google_drive':
        tokens = await this.googleService.refreshTokens(userId)
        break
      default:
        throw new OAuthError(`Unsupported source type: ${source.type}`, 'UNSUPPORTED_SOURCE_TYPE')
    }

    // SECURITY: Update tokens in Azure Key Vault ONLY - never in database
    await this.keyVaultService.storeOAuthTokens(userId, provider, tokens.accessToken, tokens.refreshToken)
  }

  /**
   * Get content from a source for ingestion
   */
  async getSourceContent(userId: string, sourceId: string) {
    await this.initialize()

    // SECURITY: Only select metadata from database - tokens are in Key Vault
    const { data: source, error } = await this.supabase
      .from('connected_sources')
      .select('id, type, name, user_id, selected_channels, selected_folders, selected_team_channels, is_active')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (error || !source) {
      throw new OAuthError('Connected source not found or inactive', 'SOURCE_NOT_FOUND')
    }

    const provider = source.type === 'teams' ? 'microsoft' : 'google'

    // Retrieve tokens from Key Vault before accessing external services
    const { accessToken, refreshToken } = await this.keyVaultService.getOAuthTokens(userId, provider)

    if (!accessToken || !refreshToken) {
      throw new OAuthError(`No valid tokens found for ${source.type} source`, 'NO_TOKENS')
    }

    switch (source.type) {
      case 'teams':
        // Get messages from selected team-channels (with proper teamId mapping)
        const teamChannels = source.selected_team_channels || []
        const allMessages = []

        for (const teamChannel of teamChannels) {
          try {
            const messages = await this.microsoftService.getChannelMessages(
              userId, 
              teamChannel.teamId, 
              teamChannel.channelId
            )
            allMessages.push(...messages)
          } catch (error) {
            console.warn(`Failed to get messages from channel ${teamChannel.displayName}:`, error)
          }
        }

        return allMessages

      case 'google_drive':
        // Get files from selected folders
        const folders = source.selected_folders || []
        const allFiles = []

        for (const folderId of folders) {
          try {
            const files = await this.googleService.getDriveItems(userId, folderId)
            allFiles.push(...files)
          } catch (error) {
            console.warn(`Failed to get files from folder ${folderId}:`, error)
          }
        }

        return allFiles

      default:
        throw new OAuthError(`Unsupported source type: ${source.type}`, 'UNSUPPORTED_SOURCE_TYPE')
    }
  }
}

// Singleton instance
let oauthService: OAuthService | null = null

export function getOAuthService(): OAuthService {
  if (!oauthService) {
    oauthService = new OAuthService()
  }
  return oauthService
}