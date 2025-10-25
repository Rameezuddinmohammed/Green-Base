export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
}

export interface OAuthProvider {
  name: string
  clientId: string
  clientSecret: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
}

export interface TeamChannelMapping {
  teamId: string
  channelId: string
  displayName: string
}

export interface ConnectedSource {
  id: string
  type: 'teams' | 'google_drive'
  name: string
  userId: string
  // SECURITY NOTE: accessToken and refreshToken are retrieved from Azure Key Vault
  // They are included here for runtime use but never stored in database
  accessToken: string
  refreshToken: string
  selectedChannels?: string[]
  selectedFolders?: string[]
  selectedTeamChannels?: TeamChannelMapping[] // For Microsoft Teams with teamId preservation
  lastSyncAt?: Date
  isActive: boolean
}

export interface TeamsChannel {
  id: string
  teamId: string // CRITICAL: Store teamId for message retrieval
  displayName: string
  description?: string
  webUrl: string
}

export interface TeamsMessage {
  id: string
  createdDateTime: string
  from: {
    user?: {
      displayName: string
      id: string
    }
  }
  body: {
    content: string
    contentType: 'text' | 'html'
  }
  attachments?: any[]
}

export interface DriveItem {
  id: string
  name: string
  webUrl: string
  folder?: {
    childCount: number
  }
  file?: {
    mimeType: string
  }
  createdDateTime: string
  lastModifiedDateTime: string
  size?: number
}

export class OAuthError extends Error {
  code: string
  statusCode?: number
  details?: any

  constructor(message: string, code: string, statusCode?: number, details?: any) {
    super(message)
    this.name = 'OAuthError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}