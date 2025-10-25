import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import { getConfigService } from '../config'
import { getKeyVaultService } from '../azure-keyvault'
import { OAuthTokens, TeamsChannel, TeamsMessage, DriveItem, OAuthError } from './types'

export class MicrosoftGraphService {
  private msalApp: ConfidentialClientApplication | null = null
  private config: any = null

  async initialize() {
    if (this.msalApp) return

    const configService = getConfigService()
    this.config = await configService.getConfig()

    this.msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: this.config.oauth.microsoft.clientId,
        clientSecret: this.config.oauth.microsoft.clientSecret,
        authority: `https://login.microsoftonline.com/${this.config.azure.tenantId}`
      }
    })
  }

  /**
   * Generate OAuth authorization URL for Microsoft Graph
   */
  async getAuthUrl(userId: string, scopes: string[] = ['https://graph.microsoft.com/Team.ReadBasic.All', 'https://graph.microsoft.com/Channel.ReadBasic.All', 'https://graph.microsoft.com/ChannelMessage.Read.All', 'https://graph.microsoft.com/Files.Read.All']): Promise<string> {
    await this.initialize()

    const authCodeUrlParameters = {
      scopes,
      redirectUri: `${process.env.NEXTAUTH_URL}/api/oauth/microsoft/callback`,
      state: userId // Pass userId as state for callback handling
    }

    try {
      const response = await this.msalApp!.getAuthCodeUrl(authCodeUrlParameters)
      return response
    } catch (error) {
      throw new OAuthError(`Failed to generate Microsoft auth URL: ${error}`, 'AUTH_URL_ERROR')
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string, userId: string): Promise<OAuthTokens> {
    await this.initialize()

    const tokenRequest = {
      code,
      scopes: ['https://graph.microsoft.com/Team.ReadBasic.All', 'https://graph.microsoft.com/Channel.ReadBasic.All', 'https://graph.microsoft.com/ChannelMessage.Read.All', 'https://graph.microsoft.com/Files.Read.All'],
      redirectUri: `${process.env.NEXTAUTH_URL}/api/oauth/microsoft/callback`
    }

    try {
      const response: AuthenticationResult = await this.msalApp!.acquireTokenByCode(tokenRequest)
      
      if (!response.accessToken) {
        throw new OAuthError('Invalid token response from Microsoft', 'INVALID_TOKEN_RESPONSE')
      }

      // MSAL doesn't provide refresh tokens directly, they're managed internally
      // We'll store a placeholder and rely on MSAL's token cache
      const tokens: OAuthTokens = {
        accessToken: response.accessToken,
        refreshToken: 'msal_managed', // MSAL manages refresh tokens internally
        expiresAt: response.expiresOn || new Date(Date.now() + 3600000), // Default 1 hour
        scopes: response.scopes || []
      }

      // Store tokens securely in Azure Key Vault
      const keyVaultService = getKeyVaultService()
      await keyVaultService.storeOAuthTokens(userId, 'microsoft', tokens.accessToken, tokens.refreshToken)

      return tokens
    } catch (error) {
      throw new OAuthError(`Failed to exchange code for tokens: ${error}`, 'TOKEN_EXCHANGE_ERROR')
    }
  }

  /**
   * Refresh access token using MSAL silent token acquisition with proper account management
   */
  async refreshTokens(userId: string): Promise<OAuthTokens> {
    await this.initialize()

    try {
      // Get cached accounts
      const accounts = await this.msalApp!.getTokenCache().getAllAccounts()
      
      if (accounts.length === 0) {
        throw new OAuthError('No cached account found for token refresh', 'NO_CACHED_ACCOUNT')
      }

      // Find the specific account for this user
      // In production, you might store the account identifier in Key Vault or database
      let targetAccount = accounts[0] // Default to first account for MVP

      // TODO: For production multi-user scenarios, implement proper account lookup:
      // const keyVaultService = getKeyVaultService()
      // const storedAccountId = await keyVaultService.getSecret(`msal-account-${userId}`)
      // if (storedAccountId) {
      //   targetAccount = accounts.find(acc => acc.homeAccountId === storedAccountId) || accounts[0]
      // }

      // Use silent token acquisition with MSAL
      const silentRequest = {
        scopes: ['https://graph.microsoft.com/Team.ReadBasic.All', 'https://graph.microsoft.com/Channel.ReadBasic.All', 'https://graph.microsoft.com/ChannelMessage.Read.All', 'https://graph.microsoft.com/Files.Read.All'],
        account: targetAccount
      }

      const response = await this.msalApp!.acquireTokenSilent(silentRequest)
      
      if (!response || !response.accessToken) {
        throw new OAuthError('Failed to refresh access token', 'REFRESH_TOKEN_ERROR')
      }

      const tokens: OAuthTokens = {
        accessToken: response.accessToken,
        refreshToken: 'msal_managed', // MSAL manages refresh tokens internally
        expiresAt: response.expiresOn || new Date(Date.now() + 3600000),
        scopes: response.scopes || []
      }

      // Update stored tokens
      const keyVaultService = getKeyVaultService()
      await keyVaultService.storeOAuthTokens(userId, 'microsoft', tokens.accessToken, tokens.refreshToken)

      // TODO: For production, store the account identifier for future lookups:
      // await keyVaultService.setSecret(`msal-account-${userId}`, targetAccount.homeAccountId)

      return tokens
    } catch (error) {
      throw new OAuthError(`Failed to refresh tokens: ${error}`, 'REFRESH_TOKEN_ERROR')
    }
  }

  /**
   * Get authenticated Microsoft Graph client
   */
  private async getGraphClient(userId: string): Promise<Client> {
    const keyVaultService = getKeyVaultService()
    let { accessToken } = await keyVaultService.getOAuthTokens(userId, 'microsoft')

    if (!accessToken) {
      throw new OAuthError('No access token found for user', 'NO_ACCESS_TOKEN')
    }

    // Try to refresh token if it might be expired (implement basic retry logic)
    const graphClient = Client.init({
      authProvider: async (done) => {
        try {
          done(null, accessToken!)
        } catch (error) {
          // If token is expired, try to refresh
          try {
            const refreshedTokens = await this.refreshTokens(userId)
            done(null, refreshedTokens.accessToken)
          } catch (refreshError) {
            done(refreshError, null)
          }
        }
      }
    })

    return graphClient
  }

  /**
   * Get user's Teams channels
   */
  async getTeamsChannels(userId: string): Promise<TeamsChannel[]> {
    try {
      const graphClient = await this.getGraphClient(userId)
      
      // Get user's joined teams
      const teamsResponse = await graphClient.api('/me/joinedTeams').get()
      const teams = teamsResponse.value || []

      const allChannels: TeamsChannel[] = []

      // Get channels for each team
      for (const team of teams) {
        try {
          const channelsResponse = await graphClient.api(`/teams/${team.id}/channels`).get()
          const channels = channelsResponse.value || []
          
          allChannels.push(...channels.map((channel: any) => ({
            id: channel.id,
            teamId: team.id, // CRITICAL: Preserve teamId for message retrieval
            displayName: `${team.displayName} - ${channel.displayName}`,
            description: channel.description,
            webUrl: channel.webUrl
          })))
        } catch (error) {
          console.warn(`Failed to get channels for team ${team.id}:`, error)
          // Continue with other teams
        }
      }

      return allChannels
    } catch (error) {
      throw new OAuthError(`Failed to get Teams channels: ${error}`, 'GET_CHANNELS_ERROR')
    }
  }

  /**
   * Get messages from a specific Teams channel
   */
  async getChannelMessages(userId: string, teamId: string, channelId: string, limit: number = 50): Promise<TeamsMessage[]> {
    try {
      const graphClient = await this.getGraphClient(userId)
      
      const messagesResponse = await graphClient
        .api(`/teams/${teamId}/channels/${channelId}/messages`)
        .top(limit)
        .orderby('createdDateTime desc')
        .get()

      return messagesResponse.value || []
    } catch (error) {
      throw new OAuthError(`Failed to get channel messages: ${error}`, 'GET_MESSAGES_ERROR')
    }
  }

  /**
   * Get user's OneDrive files and folders
   */
  async getDriveItems(userId: string, folderId?: string): Promise<DriveItem[]> {
    try {
      const graphClient = await this.getGraphClient(userId)
      
      const endpoint = folderId 
        ? `/me/drive/items/${folderId}/children`
        : '/me/drive/root/children'
      
      const itemsResponse = await graphClient.api(endpoint).get()
      
      return itemsResponse.value || []
    } catch (error) {
      throw new OAuthError(`Failed to get drive items: ${error}`, 'GET_DRIVE_ITEMS_ERROR')
    }
  }

  /**
   * Get file content from OneDrive with Azure AI Document Intelligence integration
   */
  async getFileContent(userId: string, fileId: string): Promise<string> {
    try {
      const graphClient = await this.getGraphClient(userId)
      
      // Get file metadata first to check if it's a supported text file
      const fileInfo = await graphClient.api(`/me/drive/items/${fileId}`).get()
      
      if (!fileInfo.file) {
        throw new OAuthError('Item is not a file', 'NOT_A_FILE')
      }

      const mimeType = fileInfo.file.mimeType
      const fileName = fileInfo.name

      // Handle different file types with appropriate extraction methods
      switch (mimeType) {
        case 'text/plain':
          // Direct text files
          const textContent = await graphClient.api(`/me/drive/items/${fileId}/content`).get()
          return textContent

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
        case 'application/pdf':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          // For complex documents, use Azure AI Document Intelligence
          return await this.extractDocumentContent(graphClient, fileId, fileName, mimeType)

        default:
          throw new OAuthError(`Unsupported file type: ${mimeType}`, 'UNSUPPORTED_FILE_TYPE')
      }
    } catch (error) {
      throw new OAuthError(`Failed to get file content: ${error}`, 'GET_FILE_CONTENT_ERROR')
    }
  }

  /**
   * Extract content from complex documents using Azure AI Document Intelligence
   * TODO: Implement Azure AI Document Intelligence integration for production
   */
  private async extractDocumentContent(graphClient: any, fileId: string, fileName: string, mimeType: string): Promise<string> {
    try {
      // Get file download URL
      const downloadInfo = await graphClient.api(`/me/drive/items/${fileId}`).get()
      const downloadUrl = downloadInfo['@microsoft.graph.downloadUrl']

      if (!downloadUrl) {
        throw new Error('Unable to get download URL for document')
      }

      // TODO: For production, integrate with Azure AI Document Intelligence
      // const documentIntelligenceClient = new DocumentAnalysisClient(endpoint, credential)
      // const poller = await documentIntelligenceClient.beginAnalyzeDocumentFromUrl("prebuilt-document", downloadUrl)
      // const result = await poller.pollUntilDone()
      // return result.content || ''

      // MVP: Return metadata and basic info
      return `[Document: ${fileName}]\n[Type: ${mimeType}]\n[Source: Microsoft OneDrive]\n[Note: Full content extraction requires Azure AI Document Intelligence integration]\n[Download URL available for processing]`
      
    } catch (error) {
      console.warn(`Failed to extract content from ${fileName}:`, error)
      return `[Document: ${fileName}]\n[Type: ${mimeType}]\n[Error: Content extraction failed - ${error}]`
    }
  }

  /**
   * Revoke OAuth tokens and disconnect source
   */
  async revokeTokens(userId: string): Promise<void> {
    try {
      const keyVaultService = getKeyVaultService()
      await keyVaultService.deleteOAuthTokens(userId, 'microsoft')
    } catch (error) {
      throw new OAuthError(`Failed to revoke tokens: ${error}`, 'REVOKE_TOKENS_ERROR')
    }
  }
}

// Singleton instance
let microsoftGraphService: MicrosoftGraphService | null = null

export function getMicrosoftGraphService(): MicrosoftGraphService {
  if (!microsoftGraphService) {
    microsoftGraphService = new MicrosoftGraphService()
  }
  return microsoftGraphService
}