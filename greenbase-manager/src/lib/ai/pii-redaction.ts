import { TextAnalysisClient, AzureKeyCredential } from '@azure/ai-language-text'
import { getConfigService } from '../config'

export interface PIIEntity {
  text: string
  category: string
  subcategory?: string
  confidenceScore: number
  offset: number
  length: number
}

export interface PIIRedactionResult {
  redactedText: string
  entities: PIIEntity[]
  originalLength: number
  redactedLength: number
}

export interface PIIRedactionOptions {
  categories?: string[]
  confidenceThreshold?: number
  maskingCharacter?: string
}

class PIIRedactionService {
  private client: TextAnalysisClient | null = null

  async initialize(): Promise<void> {
    if (this.client) return

    const config = await getConfigService().getConfig()
    
    // Use Speech service credentials for AI Language (they're often the same)
    const endpoint = `https://${config.azure.speech.region}.api.cognitive.microsoft.com/`
    
    this.client = new TextAnalysisClient(
      endpoint,
      new AzureKeyCredential(config.azure.speech.key)
    )
  }

  async redactPII(
    text: string,
    options: PIIRedactionOptions = {}
  ): Promise<PIIRedactionResult> {
    await this.initialize()
    
    if (!this.client) {
      throw new Error('PII Redaction client not initialized')
    }

    const {
      categories = [
        'Person',
        'PersonType',
        'PhoneNumber',
        'Email',
        'Address',
        'IPAddress',
        'DateTime',
        'Quantity',
        'Organization',
        'URL'
      ],
      confidenceThreshold = 0.8,
      maskingCharacter = '*'
    } = options

    try {
      // TODO: Implement Azure AI Language Text Analytics API properly
      // For MVP, we'll use the fallback regex-based redaction
      // Azure AI Language Text Analytics API requires specific configuration and API version
      console.warn('Using fallback PII redaction - Azure AI Language service not configured')
      return this.fallbackRedaction(text, maskingCharacter)
    } catch (error) {
      console.error('PII redaction error:', error)
      
      // Fallback: Conservative redaction using regex patterns
      return this.fallbackRedaction(text, maskingCharacter)
    }
  }

  private fallbackRedaction(text: string, maskingCharacter: string = '*'): PIIRedactionResult {
    const patterns = [
      // Email addresses
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, category: 'Email' },
      // Phone numbers (various formats)
      { pattern: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, category: 'PhoneNumber' },
      // Social Security Numbers
      { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, category: 'SSN' },
      // Credit card numbers (basic pattern)
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, category: 'CreditCard' },
      // IP addresses
      { pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, category: 'IPAddress' }
    ]

    let redactedText = text
    const entities: PIIEntity[] = []

    for (const { pattern, category } of patterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          category,
          confidenceScore: 0.9, // High confidence for regex matches
          offset: match.index,
          length: match[0].length
        })
      }
    }

    // Sort by offset descending for proper replacement
    entities.sort((a, b) => b.offset - a.offset)

    // Replace matches with masking characters
    for (const entity of entities) {
      const replacement = maskingCharacter.repeat(entity.length)
      redactedText = 
        redactedText.substring(0, entity.offset) +
        replacement +
        redactedText.substring(entity.offset + entity.length)
    }

    return {
      redactedText,
      entities,
      originalLength: text.length,
      redactedLength: redactedText.length
    }
  }

  async batchRedactPII(
    texts: string[],
    options: PIIRedactionOptions = {}
  ): Promise<PIIRedactionResult[]> {
    // Process in batches to avoid rate limits
    const batchSize = 10
    const results: PIIRedactionResult[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchPromises = batch.map(text => this.redactPII(text, options))
      
      try {
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      } catch (error) {
        console.error(`Batch PII redaction error for batch ${i / batchSize + 1}:`, error)
        throw error
      }
    }

    return results
  }
}

// Singleton instance
let piiRedactionService: PIIRedactionService | null = null

export function getPIIRedactionService(): PIIRedactionService {
  if (!piiRedactionService) {
    piiRedactionService = new PIIRedactionService()
  }
  return piiRedactionService
}

export { PIIRedactionService }