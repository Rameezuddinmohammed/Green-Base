// Simple in-memory storage for demo purposes
// This replaces database storage when no authentication is available

interface DemoSource {
  id: string
  type: 'teams' | 'google_drive'
  name: string
  userId: string
  accessToken: string
  refreshToken: string
  selectedChannels?: string[]
  selectedFolders?: string[]
  lastSyncAt?: Date
  isActive: boolean
}

class DemoStorage {
  private sources: Map<string, DemoSource> = new Map()
  private tokens: Map<string, { accessToken: string; refreshToken: string }> = new Map()

  // Sources management
  addSource(source: DemoSource): void {
    this.sources.set(source.id, source)
    console.log(`Demo: Added source ${source.id} (${source.type})`)
  }

  getSourcesByUser(userId: string): DemoSource[] {
    const userSources = Array.from(this.sources.values())
      .filter(source => source.userId === userId || userId.startsWith('demo-user'))
    console.log(`Demo: Found ${userSources.length} sources for user ${userId}`)
    return userSources
  }

  getAllSources(): DemoSource[] {
    const allSources = Array.from(this.sources.values())
    console.log(`Demo: Total sources in storage: ${allSources.length}`)
    return allSources
  }

  removeSource(sourceId: string): void {
    this.sources.delete(sourceId)
    console.log(`Demo: Removed source ${sourceId}`)
  }

  // Token management
  storeTokens(userId: string, provider: string, accessToken: string, refreshToken: string): void {
    const key = `${userId}-${provider}`
    this.tokens.set(key, { accessToken, refreshToken })
    console.log(`Demo: Stored tokens for ${key}`)
  }

  getTokens(userId: string, provider: string): { accessToken?: string; refreshToken?: string } {
    const key = `${userId}-${provider}`
    const tokens = this.tokens.get(key)
    console.log(`Demo: Retrieved tokens for ${key}:`, !!tokens)
    return tokens || {}
  }

  // Debug methods
  listAll(): void {
    console.log('Demo Storage Contents:')
    console.log('Sources:', Array.from(this.sources.entries()))
    console.log('Tokens:', Array.from(this.tokens.keys()))
  }
}

// Singleton instance
let demoStorage: DemoStorage | null = null

export function getDemoStorage(): DemoStorage {
  if (!demoStorage) {
    demoStorage = new DemoStorage()
  }
  return demoStorage
}

export { DemoStorage }
export type { DemoSource }