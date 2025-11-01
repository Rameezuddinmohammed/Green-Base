import { getPIIRedactionService, PIIRedactionOptions, PIIEntity } from '@/lib/ai/pii-redaction'

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
    piiService = getPIIRedactionService()
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

  describe('error handling and resilience', () => {
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
  })
})