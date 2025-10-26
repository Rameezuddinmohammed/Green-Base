export type OAuthProvider = 'microsoft' | 'google'

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
}

export interface ConnectedSource {
  id: string
  type: 'teams' | 'google_drive'
  name: string
  userId: string
  accessToken: string
  refreshToken: string
  selectedChannels?: string[]
  selectedFolders?: string[]
  selectedTeamChannels?: TeamChannelMapping[]
  lastSyncAt?: Date
  isActive: boolean
}

export interface TeamChannelMapping {
  teamId: string
  channelId: string
  displayName: string
}

export interface TeamsChannel {
  id: string
  teamId: string
  displayName: string
  description?: string
  webUrl?: string
}

export interface TeamsMessage {
  id: string
  createdDateTime: string
  body: {
    content: string
    contentType: string
  }
  from: {
    user?: {
      displayName: string
      id: string
    }
  }
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
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'OAuthError'
  }
}