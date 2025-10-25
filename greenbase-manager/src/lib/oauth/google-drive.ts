import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { getConfigService } from '../config'
import { getKeyVaultService } from '../azure-keyvault'
import { OAuthTokens, DriveItem, OAuthError } from './types'

export class GoogleDriveService {
  private oauth2Client: OAuth2Client | null = null
  private config: any = null

  async initialize() {
    if (this.oauth2Client) return

    const configService = getConfigService()
    this.config = await configService.getConfig()

    this.oauth2Client = new google.auth.OAuth2(
      this.config.oauth.google.clientId,
      this.config.oauth.google.clientSecret,
      `${process.env.NEXTAUTH_URL}/api/oauth/google/callback`
    )
  }

  /**
   * Generate OAuth authorization URL for Google Drive
   */
  async getAuthUrl(userId: string, scopes: string[] = ['https://www.googleapis.com/auth/drive.readonly']): Promise<string> {
    await this.initialize()

    const authUrl = this.oauth2Client!.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass userId as state for callback handling
      prompt: 'consent' // Force consent to get refresh token
    })

    return authUrl
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string, userId: string): Promise<OAuthTokens> {
    await this.initialize()

    try {
      const { tokens } = await this.oauth2Client!.getToken(code)
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new OAuthError('Invalid token response from Google', 'INVALID_TOKEN_RESPONSE')
      }

      const oauthTokens: OAuthTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600000),
        scopes: tokens.scope?.split(' ') || []
      }

      // Store tokens securely in Azure Key Vault
      const keyVaultService = getKeyVaultService()
      await keyVaultService.storeOAuthTokens(userId, 'google', oauthTokens.accessToken, oauthTokens.refreshToken)

      return oauthTokens
    } catch (error) {
      throw new OAuthError(`Failed to exchange code for tokens: ${error}`, 'TOKEN_EXCHANGE_ERROR')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(userId: string): Promise<OAuthTokens> {
    await this.initialize()

    const keyVaultService = getKeyVaultService()
    const { refreshToken } = await keyVaultService.getOAuthTokens(userId, 'google')

    if (!refreshToken) {
      throw new OAuthError('No refresh token found for user', 'NO_REFRESH_TOKEN')
    }

    try {
      this.oauth2Client!.setCredentials({ refresh_token: refreshToken })
      const { credentials } = await this.oauth2Client!.refreshAccessToken()
      
      if (!credentials.access_token) {
        throw new OAuthError('Failed to refresh access token', 'REFRESH_TOKEN_ERROR')
      }

      const tokens: OAuthTokens = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600000),
        scopes: credentials.scope?.split(' ') || []
      }

      // Update stored tokens
      await keyVaultService.storeOAuthTokens(userId, 'google', tokens.accessToken, tokens.refreshToken)

      return tokens
    } catch (error) {
      throw new OAuthError(`Failed to refresh tokens: ${error}`, 'REFRESH_TOKEN_ERROR')
    }
  }

  /**
   * Get authenticated Google Drive client
   */
  private async getDriveClient(userId: string) {
    await this.initialize()

    const keyVaultService = getKeyVaultService()
    let { accessToken, refreshToken } = await keyVaultService.getOAuthTokens(userId, 'google')

    if (!accessToken || !refreshToken) {
      throw new OAuthError('No tokens found for user', 'NO_TOKENS')
    }

    // Set credentials and handle token refresh automatically
    this.oauth2Client!.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    // Set up automatic token refresh
    this.oauth2Client!.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await keyVaultService.storeOAuthTokens(
          userId, 
          'google', 
          tokens.access_token, 
          tokens.refresh_token || refreshToken
        )
      }
    })

    return google.drive({ version: 'v3', auth: this.oauth2Client! })
  }

  /**
   * Get files and folders from Google Drive
   */
  async getDriveItems(userId: string, folderId?: string, pageSize: number = 100): Promise<DriveItem[]> {
    try {
      const drive = await this.getDriveClient(userId)
      
      const query = folderId 
        ? `'${folderId}' in parents and trashed=false`
        : `'root' in parents and trashed=false`

      const response = await drive.files.list({
        q: query,
        pageSize,
        fields: 'files(id,name,mimeType,webViewLink,createdTime,modifiedTime,size,parents)',
        orderBy: 'name'
      })

      const files = response.data.files || []
      
      return files.map((file: any) => ({
        id: file.id!,
        name: file.name!,
        webUrl: file.webViewLink!,
        folder: file.mimeType === 'application/vnd.google-apps.folder' ? { childCount: 0 } : undefined,
        file: file.mimeType !== 'application/vnd.google-apps.folder' ? { mimeType: file.mimeType! } : undefined,
        createdDateTime: file.createdTime!,
        lastModifiedDateTime: file.modifiedTime!,
        size: file.size ? parseInt(file.size) : undefined
      }))
    } catch (error) {
      throw new OAuthError(`Failed to get drive items: ${error}`, 'GET_DRIVE_ITEMS_ERROR')
    }
  }

  /**
   * Search for files in Google Drive
   */
  async searchFiles(userId: string, query: string, pageSize: number = 50): Promise<DriveItem[]> {
    try {
      const drive = await this.getDriveClient(userId)
      
      const searchQuery = `name contains '${query}' and trashed=false`

      const response = await drive.files.list({
        q: searchQuery,
        pageSize,
        fields: 'files(id,name,mimeType,webViewLink,createdTime,modifiedTime,size)',
        orderBy: 'relevance desc'
      })

      const files = response.data.files || []
      
      return files.map((file: any) => ({
        id: file.id!,
        name: file.name!,
        webUrl: file.webViewLink!,
        folder: file.mimeType === 'application/vnd.google-apps.folder' ? { childCount: 0 } : undefined,
        file: file.mimeType !== 'application/vnd.google-apps.folder' ? { mimeType: file.mimeType! } : undefined,
        createdDateTime: file.createdTime!,
        lastModifiedDateTime: file.modifiedTime!,
        size: file.size ? parseInt(file.size) : undefined
      }))
    } catch (error) {
      throw new OAuthError(`Failed to search files: ${error}`, 'SEARCH_FILES_ERROR')
    }
  }

  /**
   * Get file content from Google Drive
   */
  async getFileContent(userId: string, fileId: string): Promise<string> {
    try {
      const drive = await this.getDriveClient(userId)
      
      // Get file metadata first
      const fileInfo = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size'
      })

      const mimeType = fileInfo.data.mimeType!
      
      // Handle different file types
      if (mimeType === 'application/vnd.google-apps.document') {
        // Google Docs - export as plain text
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/plain'
        })
        return response.data as string
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Google Sheets - export as CSV
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/csv'
        })
        return response.data as string
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        // Google Slides - export as plain text
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/plain'
        })
        return response.data as string
      } else if (mimeType.startsWith('text/')) {
        // Plain text files
        const response = await drive.files.get({
          fileId,
          alt: 'media'
        })
        return response.data as string
      } else {
        // For other file types, return metadata
        return `[${mimeType} file: ${fileInfo.data.name}]`
      }
    } catch (error) {
      throw new OAuthError(`Failed to get file content: ${error}`, 'GET_FILE_CONTENT_ERROR')
    }
  }

  /**
   * Get folder structure (recursive)
   */
  async getFolderStructure(userId: string, folderId?: string, maxDepth: number = 3, currentDepth: number = 0): Promise<DriveItem[]> {
    if (currentDepth >= maxDepth) {
      return []
    }

    try {
      const items = await this.getDriveItems(userId, folderId)
      const result: DriveItem[] = []

      for (const item of items) {
        result.push(item)
        
        // If it's a folder, get its contents recursively
        if (item.folder) {
          const subItems = await this.getFolderStructure(userId, item.id, maxDepth, currentDepth + 1)
          result.push(...subItems)
        }
      }

      return result
    } catch (error) {
      throw new OAuthError(`Failed to get folder structure: ${error}`, 'GET_FOLDER_STRUCTURE_ERROR')
    }
  }

  /**
   * Rate limiting helper - implement exponential backoff
   */
  private async withRateLimit<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error
        
        // Check if it's a rate limit error
        if (error.code === 429 || (error.response && error.response.status === 429)) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // If it's not a rate limit error, throw immediately
        throw error
      }
    }
    
    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * Revoke OAuth tokens and disconnect source
   */
  async revokeTokens(userId: string): Promise<void> {
    try {
      await this.initialize()
      
      const keyVaultService = getKeyVaultService()
      const { accessToken } = await keyVaultService.getOAuthTokens(userId, 'google')
      
      if (accessToken) {
        // Revoke the token with Google
        await this.oauth2Client!.revokeToken(accessToken)
      }
      
      // Delete tokens from Key Vault
      await keyVaultService.deleteOAuthTokens(userId, 'google')
    } catch (error) {
      throw new OAuthError(`Failed to revoke tokens: ${error}`, 'REVOKE_TOKENS_ERROR')
    }
  }
}

// Singleton instance
let googleDriveService: GoogleDriveService | null = null

export function getGoogleDriveService(): GoogleDriveService {
  if (!googleDriveService) {
    googleDriveService = new GoogleDriveService()
  }
  return googleDriveService
}