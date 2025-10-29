import { getPIIRedactionService, PIIRedactionOptions } from '@/lib/ai/pii-redaction'
import { Logger } from 'openai/client'

// Mock Azure AI Language client to force fallback to regex
jest.mock('@azure/ai-language-text', () => ({
  TextAnalysisClient: jest.fn().mockImplementation(() => ({
    beginAnalyzeBatch: jest.fn().mockRejectedValue(new Error('Mocked Azure failure - forcing fallback'))
  })),
  AzureKeyCredential: jest.fn()
}))

// Mock crypto for consistent hashing in tests
jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-hash')
  })
}))

describe('PIIRedactionService', () => {
  let piiService: ReturnType<typeof getPIIRedactionService>

  beforeEach(() => {
    // Create a mock logger to suppress console output in tests
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
    piiService = getPIIRedactionService(mockLogger)
    piiService.reset() // Reset service state between tests
    jest.clearAllMocks()
  })

  describe('redactPII', () => {
    it('should redact email addresses using fallback regex', async () => {
      const text = 'Contact John Doe at john.doe@company.com for more information.'
      
      const result = await piiService.redactPII(text)

      expect(result.redactedText).toContain('***')
      expect(result.redactedText).not.toContain('john.doe@company.com')
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].category).toBe('Email')
      expect(result.entities[0].text).toBe('john.doe@company.com')
    })

    it('should redact phone numbers using fallback regex', async () => {
      const text = 'Call us at (555) 123-4567 or 555.987.6543 for support.'
      
      const result = await piiService.redactPII(text)

      expect(result.redactedText).toContain('***')
      expect(result.redactedText).not.toContain('(555) 123-4567')
      expect(result.redactedText).not.toContain('555.987.6543')
      expect(result.entities.length).toBeGreaterThanOrEqual(2)
      expect(result.entities.some(e => e.category === 'PhoneNumber')).toBe(true)
    })

    it('should redact SSN patterns using fallback regex', async () => {
      const text = 'SSN: 123-45-6789 needs to be protected.'
      
      const result = await piiService.redactPII(text)

      expect(result.redactedText).toContain('***')
      expect(result.redactedText).not.toContain('123-45-6789')
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].category).toBe('SSN')
    })

    it('should handle custom masking character', async () => {
      const text = 'Email: test@example.com'
      const options: PIIRedactionOptions = {
        maskingCharacter: 'X'
      }
      
      const result = await piiService.redactPII(text, options)

      expect(result.redactedText).toContain('X')
      expect(result.redactedText).not.toContain('*')
    })

    it('should handle text with no PII', async () => {
      const text = 'This is a clean document with no personal information.'
      
      const result = await piiService.redactPII(text)

      expect(result.redactedText).toBe(text)
      expect(result.entities).toHaveLength(0)
      expect(result.originalLength).toBe(text.length)
      expect(result.redactedLength).toBe(text.length)
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
      expect(result.averageConfidence).toBe(0)
    })

    it('should handle multiple PII types in one text', async () => {
      const text = 'Contact John at john@company.com or call (555) 123-4567. His SSN is 123-45-6789.'
      
      const result = await piiService.redactPII(text)

      expect(result.entities.length).toBeGreaterThanOrEqual(3)
      expect(result.entities.some(e => e.category === 'Email')).toBe(true)
      expect(result.entities.some(e => e.category === 'PhoneNumber')).toBe(true)
      expect(result.entities.some(e => e.category === 'SSN')).toBe(true)
    })

    it('should apply confidence threshold correctly', async () => {
      const text = 'Email: test@example.com'
      const options: PIIRedactionOptions = {
        confidenceThreshold: 0.95 // Very high threshold
      }
      
      const result = await piiService.redactPII(text, options)

      // Fallback regex should still work with high confidence
      expect(result.entities.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('batchRedactPII', () => {
    it('should process multiple texts', async () => {
      const texts = [
        'Contact alice@company.com',
        'Call (555) 123-4567',
        'Clean text with no PII'
      ]
      
      const results = await piiService.batchRedactPII(texts)

      expect(results).toHaveLength(3)
      expect(results[0].entities.length).toBeGreaterThan(0) // Has email
      expect(results[1].entities.length).toBeGreaterThan(0) // Has phone
      expect(results[2].entities.length).toBe(0) // No PII
    })

    it('should handle empty batch', async () => {
      const results = await piiService.batchRedactPII([])
      expect(results).toHaveLength(0)
    })
  })

  describe('fallback redaction patterns', () => {
    it('should detect IP addresses', async () => {
      const text = 'Server IP: 192.168.1.1 and 10.0.0.1'
      
      const result = await piiService.redactPII(text)

      expect(result.entities.some(e => e.category === 'IPAddress')).toBe(true)
      expect(result.redactedText).not.toContain('192.168.1.1')
    })

    it('should detect credit card patterns', async () => {
      const text = 'Card number: 4532-1234-5678-9012'
      
      const result = await piiService.redactPII(text)

      expect(result.entities.some(e => e.category === 'CreditCard')).toBe(true)
      expect(result.redactedText).not.toContain('4532-1234-5678-9012')
    })

    it('should handle overlapping patterns correctly', async () => {
      const text = 'Email john@company.com and phone 555-123-4567'
      
      const result = await piiService.redactPII(text)

      // Should not have overlapping redactions
      expect(result.redactedText.length).toBeGreaterThan(0)
      expect(result.entities.length).toBe(2)
    })
  })

  describe('error handling', () => {
    it('should handle very long text', async () => {
      const longText = 'A'.repeat(10000) + ' email@test.com'
      
      const result = await piiService.redactPII(longText)

      expect(result.entities.length).toBeGreaterThan(0)
      expect(result.redactedText).not.toContain('email@test.com')
    })

    it('should handle special characters', async () => {
      const text = 'Email: test@example.com with special chars'
      
      const result = await piiService.redactPII(text)

      // Should still detect the email pattern
      expect(result.entities.length).toBeGreaterThan(0)
    })
  })

  describe('enhanced features', () => {
    let mockLogger: Logger

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    })

    it('should support different masking styles', async () => {
      const text = 'Email: test@example.com'
      
      const starsResult = await piiService.redactPII(text, { maskingStyle: 'stars' })
      const bracketsResult = await piiService.redactPII(text, { maskingStyle: 'brackets' })
      const hashesResult = await piiService.redactPII(text, { maskingStyle: 'hashes' })

      expect(starsResult.redactedText).toContain('*')
      expect(bracketsResult.redactedText).toContain('[REDACTED]')
      expect(hashesResult.redactedText).toContain('#')
    })

    it('should detect Indian PII patterns', async () => {
      const text = 'Aadhaar: 1234 5678 9012, PAN: ABCDE1234F, Phone: +91 9876543210'
      
      const result = await piiService.redactPII(text)

      expect(result.entities.some(e => e.category === 'AadhaarNumber')).toBe(true)
      expect(result.entities.some(e => e.category === 'PANNumber')).toBe(true)
      expect(result.entities.some(e => e.category === 'PhoneNumber')).toBe(true)
    })

    it('should detect URLs and addresses', async () => {
      const text = 'Visit www.example.com or contact us at Flat No. 123, Main Street, City'
      
      const result = await piiService.redactPII(text)

      expect(result.entities.some(e => e.category === 'URL')).toBe(true)
      expect(result.entities.some(e => e.category === 'Address')).toBe(true)
    })

    it('should cache results for identical text', async () => {
      const text = 'Email: test@example.com'
      
      const result1 = await piiService.redactPII(text)
      const result2 = await piiService.redactPII(text)

      expect(result1.redactedText).toBe(result2.redactedText)
      expect(result1.entities).toEqual(result2.entities)
    })

    it('should log detected entities when requested', async () => {
      const testService = getPIIRedactionService(mockLogger)
      testService.reset()
      const text = 'Email: test@example.com'
      
      await testService.redactPII(text, { logDetectedEntities: true })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Fallback detected entities:'),
        expect.any(Array)
      )
    })

    it('should include processing metrics', async () => {
      const text = 'Email: test@example.com, Phone: (555) 123-4567'
      
      const result = await piiService.redactPII(text)

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
      expect(result.averageConfidence).toBeGreaterThan(0)
      expect(result.averageConfidence).toBeLessThanOrEqual(1)
    })

    it('should handle language detection gracefully', async () => {
      const text = 'Email: test@example.com'
      
      const result = await piiService.redactPII(text, { language: 'fr' })

      expect(result.entities.length).toBeGreaterThan(0)
    })
  })

  describe('batch processing enhancements', () => {
    it('should handle batch processing with delays', async () => {
      const texts = [
        'Email: alice@company.com',
        'Phone: (555) 123-4567'
      ]
      
      const results = await piiService.batchRedactPII(texts, { delayMs: 10 })

      expect(results).toHaveLength(2)
      expect(results[0].entities.length).toBeGreaterThan(0) // Has email
      expect(results[1].entities.length).toBeGreaterThan(0) // Has phone
    })

    it('should provide resilient batch processing', async () => {
      const texts = Array(25).fill('Email: test@example.com') // More than batch size
      
      const results = await piiService.batchRedactPII(texts)

      expect(results).toHaveLength(25)
      expect(results.every(r => r.entities.length > 0)).toBe(true)
    })

    it('should handle empty batch gracefully', async () => {
      const results = await piiService.batchRedactPII([])
      expect(results).toHaveLength(0)
    })
  })

  describe('error handling and resilience', () => {
    it('should reset client and cache', () => {
      expect(() => piiService.reset()).not.toThrow()
    })

    it('should handle overlapping entities correctly', async () => {
      const text = 'Contact john.doe@company.com at john.doe@company.com'
      
      const result = await piiService.redactPII(text)

      // Should detect both email instances
      expect(result.entities.length).toBeGreaterThanOrEqual(2)
      expect(result.redactedText).not.toContain('john.doe@company.com')
    })

    it('should handle multibyte characters safely', async () => {
      const text = 'Email: test@example.com 🚀 Phone: (555) 123-4567'
      
      const result = await piiService.redactPII(text)

      expect(result.redactedText).toContain('🚀') // Emoji should be preserved
      expect(result.entities.length).toBeGreaterThan(0)
    })
  })})
  describe('advanced enhancements', () => {
    let piiService: PIIRedactionService
    let mockLogger: Logger

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
      piiService = getPIIRedactionService(mockLogger)
      piiService.reset()
    })

    it('should support custom masking functions', async () => {
      const text = 'Email: test@example.com, Phone: (555) 123-4567'
      const customMasking = (entity: PIIEntity) => {
        if (entity.category === 'Email') return '[EMAIL_REDACTED]'
        if (entity.category === 'PhoneNumber') return '[PHONE_REDACTED]'
        return '[REDACTED]'
      }
      
      const result = await piiService.redactPII(text, { maskingStyle: customMasking })

      expect(result.redactedText).toContain('[EMAIL_REDACTED]')
      expect(result.redactedText).toContain('[PHONE_REDACTED]')
    })

    it('should provide category statistics', async () => {
      const text = 'Email: test@example.com, Phone: (555) 123-4567, IP: 192.168.1.1'
      
      const result = await piiService.redactPII(text)

      expect(result.categoryStats).toBeDefined()
      expect(Object.keys(result.categoryStats!).length).toBeGreaterThan(0)
      
      // Check that each category has count and avgConfidence
      for (const [category, stats] of Object.entries(result.categoryStats!)) {
        expect(stats.count).toBeGreaterThan(0)
        expect(stats.avgConfidence).toBeGreaterThan(0)
        expect(stats.avgConfidence).toBeLessThanOrEqual(1)
      }
    })

    it('should support progress callbacks in batch processing', async () => {
      const texts = Array(15).fill('Email: test@example.com') // More than one batch
      const progressCalls: any[] = []
      
      const onProgress = (info: any) => {
        progressCalls.push(info)
      }
      
      await piiService.batchRedactPII(texts, { onProgress })

      expect(progressCalls.length).toBeGreaterThan(0)
      expect(progressCalls[0]).toHaveProperty('batchNumber')
      expect(progressCalls[0]).toHaveProperty('totalBatches')
      expect(progressCalls[0]).toHaveProperty('successCount')
      expect(progressCalls[0]).toHaveProperty('failureCount')
    })

    it('should run benchmark utility', async () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
      const benchmarkService = getPIIRedactionService(mockLogger)
      
      await benchmarkService.benchmark('Email: test@example.com', 3)

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Starting PII redaction benchmark'))
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Benchmark Results'))
    })

    it('should handle partial masking with custom functions', async () => {
      const text = 'Credit card: 4532-1234-5678-9012'
      const partialMasking = (entity: PIIEntity) => {
        if (entity.category === 'CreditCard') {
          // Show last 4 digits
          const cardNumber = entity.text.replace(/\D/g, '')
          return '****-****-****-' + cardNumber.slice(-4)
        }
        return '[REDACTED]'
      }
      
      const result = await piiService.redactPII(text, { maskingStyle: partialMasking })

      expect(result.redactedText).toContain('****-****-****-9012')
    })
  })