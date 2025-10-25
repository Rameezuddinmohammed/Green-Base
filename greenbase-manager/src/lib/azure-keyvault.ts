import { SecretClient } from '@azure/keyvault-secrets'
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity'

class AzureKeyVaultService {
  private client: SecretClient
  
  constructor() {
    const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL
    
    if (!keyVaultUrl) {
      throw new Error('AZURE_KEY_VAULT_URL environment variable is required')
    }

    // Use different credential types based on environment
    let credential
    
    if (process.env.NODE_ENV === 'production') {
      // In production, use managed identity or service principal
      credential = new DefaultAzureCredential()
    } else {
      // In development, use client secret credential
      const clientId = process.env.AZURE_CLIENT_ID
      const clientSecret = process.env.AZURE_CLIENT_SECRET
      const tenantId = process.env.AZURE_TENANT_ID
      
      if (!clientId || !clientSecret || !tenantId) {
        throw new Error('Azure credentials are required for development environment')
      }
      
      credential = new ClientSecretCredential(tenantId, clientId, clientSecret)
    }
    
    this.client = new SecretClient(keyVaultUrl, credential)
  }

  async getSecret(secretName: string): Promise<string | undefined> {
    try {
      const secret = await this.client.getSecret(secretName)
      return secret.value
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error)
      return undefined
    }
  }

  async setSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      await this.client.setSecret(secretName, secretValue)
    } catch (error) {
      console.error(`Failed to set secret ${secretName}:`, error)
      throw error
    }
  }

  async deleteSecret(secretName: string): Promise<void> {
    try {
      await this.client.beginDeleteSecret(secretName)
    } catch (error) {
      console.error(`Failed to delete secret ${secretName}:`, error)
      throw error
    }
  }

  // Helper methods for OAuth tokens
  async storeOAuthTokens(userId: string, provider: string, accessToken: string, refreshToken: string): Promise<void> {
    const accessTokenKey = `oauth-${provider}-access-${userId}`
    const refreshTokenKey = `oauth-${provider}-refresh-${userId}`
    
    await Promise.all([
      this.setSecret(accessTokenKey, accessToken),
      this.setSecret(refreshTokenKey, refreshToken)
    ])
  }

  async getOAuthTokens(userId: string, provider: string): Promise<{ accessToken?: string; refreshToken?: string }> {
    const accessTokenKey = `oauth-${provider}-access-${userId}`
    const refreshTokenKey = `oauth-${provider}-refresh-${userId}`
    
    const [accessToken, refreshToken] = await Promise.all([
      this.getSecret(accessTokenKey),
      this.getSecret(refreshTokenKey)
    ])
    
    return { accessToken, refreshToken }
  }

  async deleteOAuthTokens(userId: string, provider: string): Promise<void> {
    const accessTokenKey = `oauth-${provider}-access-${userId}`
    const refreshTokenKey = `oauth-${provider}-refresh-${userId}`
    
    await Promise.all([
      this.deleteSecret(accessTokenKey),
      this.deleteSecret(refreshTokenKey)
    ])
  }
}

// Singleton instance
let keyVaultService: AzureKeyVaultService | null = null

export function getKeyVaultService(): AzureKeyVaultService {
  if (!keyVaultService) {
    keyVaultService = new AzureKeyVaultService()
  }
  return keyVaultService
}

export { AzureKeyVaultService }