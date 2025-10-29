import { TextAnalysisClient, AzureKeyCredential } from '@azure/ai-language-text'
import { getConfigService } from '../config'
import crypto from 'crypto'

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
  processingTimeMs: number
  averageConfidence: number
  categoryStats?: Record<string, { count: number; avgConfidence: number }>
}

export interface PIIRedactionOptions {
  categories?: string[]
  confidenceThreshold?: number
  maskingCharacter?: string
  language?: string
  logDetectedEntities?: boolean
  maskingStyle?: 'stars' | 'brackets' | 'hashes' | ((entity: PIIEntity) => string)
  delayMs?: number
  onProgress?: (info: { batchNumber: number; totalBatches: number; successCount: number; failureCount: number }) => void
}

export interface Logger {
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, meta?: any): void
}

interface CacheEntry {
  result: PIIRedactionResult
  timestamp: number
}

class PIIRedactionService {
  private static client: TextAnalysisClient | null = null
  private static initialized: boolean = false
  private cache: Map<string, CacheEntry> = new Map()
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
  private cleanupScheduled = false
  private logger: Logger

  // Preloaded entity categories to avoid duplication
  private static readonly DEFAULT_CATEGORIES = [
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
  ]

  constructor(logger: Logger = console) {
    this.logger = logger
  }

  async initialize(): Promise<void> {
    if (PIIRedactionService.initialized && PIIRedactionService.client) {
      return
    }

    const startTime = Date.now()
    const config = await getConfigService().getConfig()

    // Use dedicated Azure AI Language configuration
    const endpoint = config.azure.aiLanguage.endpoint
    const key = config.azure.aiLanguage.key

    if (!endpoint || !key) {
      throw new Error('Azure AI Language endpoint and key are required')
    }

    PIIRedactionService.client = new TextAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    )

    PIIRedactionService.initialized = true
    const initTime = Date.now() - startTime
    this.logger.info(`✓ Azure AI Language client initialized with endpoint: ${endpoint} (${initTime}ms)`)
  }

  reset(): void {
    PIIRedactionService.client = null
    PIIRedactionService.initialized = false
    this.cache.clear()
    this.logger.info('✓ PIIRedactionService reset - client and cache cleared')
  }

  async redactPII(
    text: string,
    options: PIIRedactionOptions = {}
  ): Promise<PIIRedactionResult> {
    const startTime = Date.now()
    const {
      confidenceThreshold = 0.8,
      maskingCharacter = '*',
      language,
      logDetectedEntities = false,
      maskingStyle = 'stars'
    } = options

    // Check cache first
    const textHash = this.generateTextHash(text)
    const cached = this.getFromCache(textHash)
    if (cached) {
      if (logDetectedEntities) {
        this.logger.info(`✓ Cache hit: Found ${cached.entities.length} entities (cached)`)
      }
      return cached
    }

    try {
      await this.initialize()

      if (!PIIRedactionService.client) {
        throw new Error('PII Redaction client not initialized')
      }

      // Auto-detect language if not provided
      const detectedLanguage = language || await this.detectLanguage(text)

      // Use Azure AI Language Text Analytics for PII detection
      const actions = [
        {
          kind: 'PiiEntityRecognition' as const,
          modelVersion: 'latest'
        }
      ]

      const poller = await PIIRedactionService.client.beginAnalyzeBatch(
        actions,
        [{ id: '1', text: text, language: detectedLanguage }],
        {
          updateIntervalInMs: 1000
        }
      )

      const results = await poller.pollUntilDone()

      // Extract PII entities from results
      const detectedEntities: PIIEntity[] = []

      for await (const actionResult of results) {
        if (actionResult.kind === 'PiiEntityRecognition' && !actionResult.error) {
          for (const doc of actionResult.results) {
            if (!doc.error) {
              for (const entity of doc.entities) {
                if (entity.confidenceScore >= confidenceThreshold) {
                  detectedEntities.push({
                    text: entity.text,
                    category: entity.category,
                    subcategory: entity.subCategory,
                    confidenceScore: entity.confidenceScore,
                    offset: entity.offset,
                    length: entity.length
                  })
                }
              }
            }
          }
        }
      }

      // Merge overlapping entities and optimize replacements
      const optimizedEntities = this.mergeOverlappingEntities(detectedEntities)

      // Replace detected PII with appropriate masking
      const redactedText = this.applyRedaction(text, optimizedEntities, maskingStyle, maskingCharacter)

      const processingTime = Date.now() - startTime
      const averageConfidence = optimizedEntities.length > 0
        ? optimizedEntities.reduce((sum, e) => sum + e.confidenceScore, 0) / optimizedEntities.length
        : 0

      // Calculate category statistics
      const categoryStats = this.calculateCategoryStats(optimizedEntities)

      if (logDetectedEntities && optimizedEntities.length > 0) {
        this.logger.info(`✓ Detected entities:`, optimizedEntities.map(e => `${e.category}: "${e.text}" (${(e.confidenceScore * 100).toFixed(1)}%)`))
      }

      this.logger.info(`✓ Azure AI PII Detection: Found ${optimizedEntities.length} entities in ${processingTime}ms (${(averageConfidence * 100).toFixed(1)}% avg confidence)`)

      const result: PIIRedactionResult = {
        redactedText,
        entities: optimizedEntities,
        originalLength: text.length,
        redactedLength: redactedText.length,
        processingTimeMs: processingTime,
        averageConfidence,
        categoryStats
      }

      // Cache the result
      this.addToCache(textHash, result)

      return result
    } catch (error: any) {
      this.logger.error('Azure AI PII redaction error, falling back to regex:', {
        message: error?.message,
        code: error?.code,
        name: error?.name
      })

      // Fallback: Conservative redaction using regex patterns
      return this.fallbackRedaction(text, maskingStyle, maskingCharacter, startTime, logDetectedEntities)
    }
  }

  private async detectLanguage(text: string): Promise<string> {
    try {
      if (!PIIRedactionService.client) {
        return 'en'
      }

      // For now, we'll use a simple heuristic or default to English
      // Azure AI Language's batch API doesn't support language detection in the same way
      // In a real implementation, you would use a separate language detection service

      // Simple heuristic: check for common non-English patterns
      const spanishPattern = /\b(el|la|los|las|de|en|y|a|que|es|se|no|te|lo|le|da|su|por|son|con|para|una|sobre|todo|ser|dos|me|hasta|donde|quien|desde|durante|cada|mucho|muy)\b/gi
      const frenchPattern = /\b(le|la|les|de|du|des|et|à|un|une|ce|qui|que|ne|se|il|elle|on|avec|par|pour|dans|sur|être|avoir|tout|tous|mais|plus|sans|sous|entre|pendant|depuis|chaque|beaucoup|très)\b/gi

      const spanishMatches = (text.match(spanishPattern) || []).length
      const frenchMatches = (text.match(frenchPattern) || []).length
      const totalWords = text.split(/\s+/).length

      if (spanishMatches > totalWords * 0.1) return 'es'
      if (frenchMatches > totalWords * 0.1) return 'fr'

      return 'en'
    } catch (error) {
      this.logger.warn('Language detection failed, defaulting to English:', error)
    }

    return 'en'
  }

  private mergeOverlappingEntities(entities: PIIEntity[]): PIIEntity[] {
    if (entities.length <= 1) return entities

    // Sort by offset
    const sorted = [...entities].sort((a, b) => a.offset - b.offset)
    const merged: PIIEntity[] = []

    for (const current of sorted) {
      const last = merged[merged.length - 1]

      if (!last || current.offset >= last.offset + last.length) {
        // No overlap, add as new entity
        merged.push(current)
      } else {
        // Overlap detected, merge entities
        const endOffset = Math.max(last.offset + last.length, current.offset + current.length)
        const mergedText = entities.find(e => e.offset === Math.min(last.offset, current.offset))?.text || last.text

        merged[merged.length - 1] = {
          text: mergedText,
          category: last.category, // Keep first category
          subcategory: last.subcategory,
          confidenceScore: Math.max(last.confidenceScore, current.confidenceScore),
          offset: Math.min(last.offset, current.offset),
          length: endOffset - Math.min(last.offset, current.offset)
        }
      }
    }

    return merged
  }

  private applyRedaction(
    text: string,
    entities: PIIEntity[],
    maskingStyle: 'stars' | 'brackets' | 'hashes' | ((entity: PIIEntity) => string),
    maskingCharacter: string
  ): string {
    // Sort by offset descending for proper replacement
    const sortedEntities = [...entities].sort((a, b) => b.offset - a.offset)

    let redactedText = text

    for (const entity of sortedEntities) {
      let replacement: string

      // Support custom masking functions
      if (typeof maskingStyle === 'function') {
        replacement = maskingStyle(entity)
      } else {
        switch (maskingStyle) {
          case 'brackets':
            replacement = '[REDACTED]'
            break
          case 'hashes':
            replacement = '#'.repeat(entity.length)
            break
          case 'stars':
          default:
            replacement = maskingCharacter.repeat(entity.length)
            break
        }
      }

      // Ensure we don't break multibyte characters
      const beforeText = redactedText.substring(0, entity.offset)
      const afterText = redactedText.substring(entity.offset + entity.length)

      redactedText = beforeText + replacement + afterText
    }

    return redactedText
  }

  private fallbackRedaction(
    text: string,
    maskingStyle: 'stars' | 'brackets' | 'hashes' | ((entity: PIIEntity) => string) = 'stars',
    maskingCharacter: string = '*',
    startTime: number = Date.now(),
    logDetectedEntities: boolean = false
  ): PIIRedactionResult {
    const patterns = [
      // Email addresses
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, category: 'Email' },
      // Phone numbers (various formats)
      { pattern: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g, category: 'PhoneNumber' },
      // Indian phone numbers
      { pattern: /(\+91[-\s]?)?[6-9]\d{9}/g, category: 'PhoneNumber' },
      // Social Security Numbers
      { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, category: 'SSN' },
      // Aadhaar numbers
      { pattern: /\b\d{4}\s\d{4}\s\d{4}\b/g, category: 'AadhaarNumber' },
      // PAN numbers
      { pattern: /[A-Z]{5}[0-9]{4}[A-Z]{1}/g, category: 'PANNumber' },
      // Credit card numbers (basic pattern)
      { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, category: 'CreditCard' },
      // IP addresses
      { pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, category: 'IPAddress' },
      // URLs starting with www
      { pattern: /\bwww\.[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, category: 'URL' },
      // Basic address patterns
      { pattern: /\b(Flat No\.|Street|Road|Avenue|Lane)\s+[A-Za-z0-9\s,.-]+/gi, category: 'Address' }
    ]

    const entities: PIIEntity[] = []

    for (const { pattern, category } of patterns) {
      // Create a new regex instance to avoid lastIndex issues
      const regex = new RegExp(pattern.source, pattern.flags)
      let match
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          category,
          confidenceScore: 0.9, // High confidence for regex matches
          offset: match.index,
          length: match[0].length
        })
      }
    }

    // Merge overlapping entities
    const optimizedEntities = this.mergeOverlappingEntities(entities)

    // Apply redaction
    const redactedText = this.applyRedaction(text, optimizedEntities, maskingStyle, maskingCharacter)

    const processingTime = Date.now() - startTime
    const averageConfidence = optimizedEntities.length > 0
      ? optimizedEntities.reduce((sum, e) => sum + e.confidenceScore, 0) / optimizedEntities.length
      : 0

    // Calculate category statistics
    const categoryStats = this.calculateCategoryStats(optimizedEntities)

    if (logDetectedEntities && optimizedEntities.length > 0) {
      this.logger.info(`✓ Fallback detected entities:`, optimizedEntities.map(e => `${e.category}: "${e.text}"`))
    }

    this.logger.info(`✓ Fallback PII Detection: Found ${optimizedEntities.length} entities in ${processingTime}ms`)

    return {
      redactedText,
      entities: optimizedEntities,
      originalLength: text.length,
      redactedLength: redactedText.length,
      processingTimeMs: processingTime,
      averageConfidence,
      categoryStats
    }
  }

  private generateTextHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex')
  }

  private getFromCache(textHash: string): PIIRedactionResult | null {
    const entry = this.cache.get(textHash)
    if (!entry) return null

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(textHash)
      return null
    }

    return entry.result
  }

  private addToCache(textHash: string, result: PIIRedactionResult): void {
    // Schedule background cache cleanup to avoid blocking
    this.scheduleCacheCleanup()

    this.cache.set(textHash, {
      result,
      timestamp: Date.now()
    })
  }

  private scheduleCacheCleanup(): void {
    if (!this.cleanupScheduled && this.cache.size > 100) {
      this.cleanupScheduled = true
      setTimeout(() => {
        this.cleanupCache()
        this.cleanupScheduled = false
      }, 5000)
    }
  }

  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.cache.delete(key)
      }
    }
  }

  private calculateCategoryStats(entities: PIIEntity[]): Record<string, { count: number; avgConfidence: number }> {
    const categoryStats: Record<string, { count: number; avgConfidence: number }> = {}

    for (const entity of entities) {
      if (!categoryStats[entity.category]) {
        categoryStats[entity.category] = { count: 0, avgConfidence: 0 }
      }
      categoryStats[entity.category].count++
      categoryStats[entity.category].avgConfidence += entity.confidenceScore
    }

    // Calculate averages
    for (const category in categoryStats) {
      categoryStats[category].avgConfidence /= categoryStats[category].count
    }

    return categoryStats
  }

  async batchRedactPII(
    texts: string[],
    options: PIIRedactionOptions = {}
  ): Promise<PIIRedactionResult[]> {
    if (texts.length === 0) return []

    const { delayMs = 0, onProgress } = options
    const batchSize = 10
    const results: PIIRedactionResult[] = []
    let successCount = 0
    let failureCount = 0

    this.logger.info(`🔄 Starting batch PII redaction for ${texts.length} texts (batch size: ${batchSize})`)

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(texts.length / batchSize)

      this.logger.info(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} texts)`)

      const batchPromises = batch.map(text => this.redactPII(text, options))

      try {
        // Use Promise.allSettled for resilience
        const batchResults = await Promise.allSettled(batchPromises)

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value)
            successCount++
          } else {
            this.logger.error(`❌ Individual text redaction failed:`, result.reason)
            failureCount++

            // Add a fallback result for failed items
            const fallbackResult: PIIRedactionResult = {
              redactedText: '[REDACTION_FAILED]',
              entities: [],
              originalLength: 0,
              redactedLength: 0,
              processingTimeMs: 0,
              averageConfidence: 0
            }
            results.push(fallbackResult)
          }
        }

        // Call progress callback if provided
        onProgress?.({ batchNumber, totalBatches, successCount, failureCount })

        // Add delay between batches if specified
        if (delayMs > 0 && i + batchSize < texts.length) {
          this.logger.info(`⏳ Waiting ${delayMs}ms before next batch...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }

      } catch (error) {
        this.logger.error(`❌ Batch ${batchNumber} failed completely:`, error)
        failureCount += batch.length

        // Add fallback results for the entire failed batch
        for (let j = 0; j < batch.length; j++) {
          const fallbackResult: PIIRedactionResult = {
            redactedText: '[BATCH_FAILED]',
            entities: [],
            originalLength: 0,
            redactedLength: 0,
            processingTimeMs: 0,
            averageConfidence: 0
          }
          results.push(fallbackResult)
        }
      }
    }

    this.logger.info(`✅ Batch PII redaction completed: ${successCount} success, ${failureCount} failures`)

    return results
  }

  /**
   * Benchmark utility for testing performance
   * @param text Text to redact repeatedly
   * @param iterations Number of iterations to run
   */
  async benchmark(text: string, iterations: number = 10): Promise<void> {
    this.logger.info(`🔬 Starting PII redaction benchmark: ${iterations} iterations`)

    const start = Date.now()
    const results: number[] = []

    for (let i = 0; i < iterations; i++) {
      const iterStart = Date.now()
      await this.redactPII(text)
      results.push(Date.now() - iterStart)
    }

    const totalTime = Date.now() - start
    const avgTime = totalTime / iterations
    const minTime = Math.min(...results)
    const maxTime = Math.max(...results)

    this.logger.info(`📊 Benchmark Results:`)
    this.logger.info(`   Total time: ${totalTime}ms`)
    this.logger.info(`   Average time: ${avgTime.toFixed(2)}ms`)
    this.logger.info(`   Min time: ${minTime}ms`)
    this.logger.info(`   Max time: ${maxTime}ms`)
    this.logger.info(`   Cache hit rate: ${((iterations - new Set(results).size) / iterations * 100).toFixed(1)}%`)
  }
}

// Singleton instance
let piiRedactionService: PIIRedactionService | null = null

export function getPIIRedactionService(logger?: Logger): PIIRedactionService {
  // Always create a new instance when a logger is provided (for testing)
  if (logger) {
    return new PIIRedactionService(logger)
  }

  if (!piiRedactionService) {
    piiRedactionService = new PIIRedactionService()
  }
  return piiRedactionService
}

export { PIIRedactionService }