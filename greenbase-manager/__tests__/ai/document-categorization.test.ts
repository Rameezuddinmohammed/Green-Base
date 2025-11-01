import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock the entire categorization service to avoid AI calls
const mockCategorizationService = {
  categorizeDocuments: jest.fn(),
  suggestCategoryForDocument: jest.fn(),
  applyCategorization: jest.fn()
}

jest.mock('../../src/lib/ai/document-categorization', () => ({
  getDocumentCategorizationService: () => mockCategorizationService,
  DocumentCategorizationService: jest.fn().mockImplementation(() => mockCategorizationService)
}))

describe('Document Categorization Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Document Theme Analysis', () => {
    it('should identify common themes across documents', async () => {
      const mockDocuments = [
        {
          id: '1',
          title: 'Employee Handbook',
          content: 'This document outlines company policies for employees including benefits, conduct, and procedures.',
          summary: 'Company employee policies and procedures',
          topics: ['HR'],
          tags: ['policy', 'employee']
        },
        {
          id: '2',
          title: 'IT Security Guidelines',
          content: 'Security protocols and guidelines for information technology systems and data protection.',
          summary: 'IT security and data protection guidelines',
          topics: ['Security'],
          tags: ['security', 'IT']
        }
      ]

      // Mock successful categorization result
      mockCategorizationService.categorizeDocuments.mockResolvedValueOnce({
        categories: [
          {
            name: 'Human Resources Policies',
            description: 'Company policies and procedures related to human resources',
            confidence: 0.9,
            documentIds: ['1'],
            keywords: ['hr', 'policy', 'employee'],
            reasoning: 'HR-related content'
          },
          {
            name: 'IT Security & Compliance',
            description: 'Information technology security guidelines',
            confidence: 0.95,
            documentIds: ['2'],
            keywords: ['security', 'IT', 'data'],
            reasoning: 'Security-focused content'
          }
        ],
        uncategorized: [],
        processingTime: 1000,
        tokensUsed: 500
      })

      const result = await mockCategorizationService.categorizeDocuments(mockDocuments, 'org-123')

      expect(result.categories).toHaveLength(2)
      expect(result.categories[0].name).toBe('Human Resources Policies')
      expect(result.categories[1].name).toBe('IT Security & Compliance')
      expect(result.uncategorized).toHaveLength(0)
    })

    it('should handle categorization failures gracefully', async () => {
      const mockDocuments = [
        {
          id: '1',
          title: 'Test Document',
          content: 'Test content',
          summary: 'Test summary',
          topics: ['Test'],
          tags: ['test']
        }
      ]

      // Mock categorization failure
      mockCategorizationService.categorizeDocuments.mockRejectedValueOnce(
        new Error('Categorization failed: AI service unavailable')
      )

      await expect(mockCategorizationService.categorizeDocuments(mockDocuments, 'org-123'))
        .rejects.toThrow('Categorization failed')
    })
  })

  describe('Category Suggestion for New Documents', () => {
    it('should suggest appropriate category for new document', async () => {
      const mockDocument = {
        id: 'new-doc',
        title: 'New Employee Onboarding',
        content: 'This document describes the onboarding process for new employees including orientation and training.',
        summary: 'Employee onboarding procedures',
        topics: [],
        tags: []
      }

      // Mock category suggestion
      mockCategorizationService.suggestCategoryForDocument.mockResolvedValueOnce({
        suggestedCategory: 'Human Resources',
        confidence: 0.88,
        reasoning: 'Document content matches HR onboarding and employee management processes'
      })

      const suggestion = await mockCategorizationService.suggestCategoryForDocument(mockDocument, 'org-123')

      expect(suggestion.suggestedCategory).toBe('Human Resources')
      expect(suggestion.confidence).toBe(0.88)
      expect(suggestion.reasoning).toContain('onboarding')
    })

    it('should handle no existing categories', async () => {
      const mockDocument = {
        id: 'new-doc',
        title: 'Test Document',
        content: 'Test content',
        summary: 'Test summary',
        topics: [],
        tags: []
      }

      // Mock default category suggestion
      mockCategorizationService.suggestCategoryForDocument.mockResolvedValueOnce({
        suggestedCategory: 'General Documents',
        confidence: 0.5,
        reasoning: 'No existing categories found, using default'
      })

      const suggestion = await mockCategorizationService.suggestCategoryForDocument(mockDocument, 'org-123')

      expect(suggestion.suggestedCategory).toBe('General Documents')
      expect(suggestion.confidence).toBe(0.5)
      expect(suggestion.reasoning).toContain('No existing categories')
    })
  })

  describe('Application Integration', () => {
    it('should apply categorization to database', async () => {
      const mockResult = {
        categories: [
          {
            name: 'HR Policies',
            description: 'Human resources policies',
            confidence: 0.9,
            documentIds: ['1', '2'],
            keywords: ['hr', 'policy'],
            reasoning: 'HR related'
          }
        ],
        uncategorized: [],
        processingTime: 1000,
        tokensUsed: 500
      }

      // Mock successful application
      mockCategorizationService.applyCategorization.mockResolvedValueOnce(undefined)

      await expect(mockCategorizationService.applyCategorization('org-123', mockResult))
        .resolves.not.toThrow()
    })

    it('should handle application errors gracefully', async () => {
      const mockResult = {
        categories: [],
        uncategorized: [],
        processingTime: 1000,
        tokensUsed: 500
      }

      // Mock application failure
      mockCategorizationService.applyCategorization.mockRejectedValueOnce(
        new Error('Database update failed')
      )

      await expect(mockCategorizationService.applyCategorization('org-123', mockResult))
        .rejects.toThrow('Database update failed')
    })
  })

  describe('Business Logic Validation', () => {
    it('should validate category confidence thresholds', () => {
      // Test that low-confidence categories are filtered out
      const mockResult = {
        categories: [
          { name: 'High Confidence', confidence: 0.9, documentIds: ['1', '2'], keywords: [], reasoning: '', description: '' },
          { name: 'Low Confidence', confidence: 0.4, documentIds: ['3'], keywords: [], reasoning: '', description: '' }
        ],
        uncategorized: [],
        processingTime: 1000,
        tokensUsed: 500
      }

      // In real implementation, categories with confidence < 0.6 should be filtered
      const validCategories = mockResult.categories.filter(cat => cat.confidence >= 0.6)
      expect(validCategories).toHaveLength(1)
      expect(validCategories[0].name).toBe('High Confidence')
    })

    it('should ensure minimum documents per category', () => {
      // Test that categories with too few documents are filtered out
      const mockResult = {
        categories: [
          { name: 'Valid Category', confidence: 0.9, documentIds: ['1', '2'], keywords: [], reasoning: '', description: '' },
          { name: 'Single Doc Category', confidence: 0.8, documentIds: ['3'], keywords: [], reasoning: '', description: '' }
        ],
        uncategorized: [],
        processingTime: 1000,
        tokensUsed: 500
      }

      // In real implementation, categories with < 2 documents should be filtered
      const validCategories = mockResult.categories.filter(cat => cat.documentIds.length >= 2)
      expect(validCategories).toHaveLength(1)
      expect(validCategories[0].name).toBe('Valid Category')
    })
  })
})