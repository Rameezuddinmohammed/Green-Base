import { getKeyVaultService } from './azure-keyvault'

export interface AppConfig {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  azure: {
    keyVaultUrl: string
    clientId: string
    clientSecret: string
    tenantId: string
    openai: {
      endpoint: string
      apiKey: string
      deploymentName: string
      embeddingDeploymentName: string
    }
    speech: {
      key: string
      region: string
    }
    aiLanguage: {
      endpoint: string
      key: string
    }
  }
  oauth: {
    microsoft: {
      clientId: string
      clientSecret: string
    }
    google: {
      clientId: string
      clientSecret: string
    }
  }
  nextAuth: {
    url: string
    secret: string
  }
}

class ConfigService {
  private config: AppConfig | null = null
  private keyVaultService = getKeyVaultService()

  async getConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config
    }

    // In development, use environment variables
    // In production, fetch sensitive values from Azure Key Vault
    const isProduction = process.env.NODE_ENV === 'production'

    let supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (isProduction) {
      try {
        const keyVaultKey = await this.keyVaultService.getSecret('supabase-service-role-key')
        if (keyVaultKey) {
          supabaseServiceRoleKey = keyVaultKey
        }
      } catch (error) {
        console.warn('Failed to get Supabase service role key from Key Vault, using environment variable')
      }
    }

    this.config = {
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        serviceRoleKey: supabaseServiceRoleKey
      },
      azure: {
        keyVaultUrl: process.env.AZURE_KEY_VAULT_URL!,
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        tenantId: process.env.AZURE_TENANT_ID!,
        openai: {
          endpoint: isProduction
            ? await this.keyVaultService.getSecret('azure-openai-endpoint') || ''
            : process.env.AZURE_OPENAI_ENDPOINT!,
          apiKey: isProduction
            ? await this.keyVaultService.getSecret('azure-openai-api-key') || ''
            : process.env.AZURE_OPENAI_API_KEY!,
          deploymentName: isProduction
            ? await this.keyVaultService.getSecret('azure-openai-deployment-name') || ''
            : process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
          embeddingDeploymentName: isProduction
            ? await this.keyVaultService.getSecret('azure-openai-embedding-deployment-name') || ''
            : process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME!
        },
        speech: {
          key: isProduction
            ? await this.keyVaultService.getSecret('azure-speech-key') || ''
            : process.env.AZURE_SPEECH_KEY!,
          region: isProduction
            ? await this.keyVaultService.getSecret('azure-speech-region') || ''
            : process.env.AZURE_SPEECH_REGION!
        },
        aiLanguage: {
          endpoint: isProduction
            ? await this.keyVaultService.getSecret('azure-ai-language-endpoint') || ''
            : process.env.AZURE_AI_LANGUAGE_ENDPOINT!,
          key: isProduction
            ? await this.keyVaultService.getSecret('azure-ai-language-key') || ''
            : process.env.AZURE_AI_LANGUAGE_KEY!
        }
      },
      oauth: {
        microsoft: {
          clientId: isProduction
            ? await this.keyVaultService.getSecret('microsoft-client-id') || ''
            : process.env.MICROSOFT_CLIENT_ID!,
          clientSecret: isProduction
            ? await this.keyVaultService.getSecret('microsoft-client-secret') || ''
            : process.env.MICROSOFT_CLIENT_SECRET!
        },
        google: {
          clientId: isProduction
            ? await this.keyVaultService.getSecret('google-client-id') || ''
            : process.env.GOOGLE_CLIENT_ID!,
          clientSecret: isProduction
            ? await this.keyVaultService.getSecret('google-client-secret') || ''
            : process.env.GOOGLE_CLIENT_SECRET!
        }
      },
      nextAuth: {
        url: process.env.NEXTAUTH_URL!,
        secret: isProduction
          ? await this.keyVaultService.getSecret('nextauth-secret') || ''
          : process.env.NEXTAUTH_SECRET!
      }
    }

    return this.config
  }

  // Helper method to validate required configuration
  validateConfig(config: AppConfig): void {
    const requiredFields = [
      'supabase.url',
      'supabase.anonKey',
      'supabase.serviceRoleKey',
      'azure.keyVaultUrl',
      'nextAuth.url',
      'nextAuth.secret'
    ]

    for (const field of requiredFields) {
      const value = this.getNestedValue(config, field)
      if (!value) {
        throw new Error(`Missing required configuration: ${field}`)
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }
}

// Singleton instance
let configService: ConfigService | null = null

export function getConfigService(): ConfigService {
  if (!configService) {
    configService = new ConfigService()
  }
  return configService
}

export { ConfigService }