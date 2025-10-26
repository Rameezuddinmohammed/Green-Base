import { ConfidenceScoring, SourceMetadata, ConfidenceWeights } from '@/lib/ai/confidence-scoring'

describe('ConfidenceScoring', () => {
  const mockSourceMetadata: SourceMetadata[] = [
    {
      type: 'teams',
      authorCount: 3,
      messageCount: 15,
      lastModified: new Date('2024-01-15'),
      participants: ['Alice', 'Bob', 'Charlie']
    },
    {
      type: 'google_drive',
      authorCount: 2,
      lastModified: new Date('2024-01-10'),
      participants: ['Alice', 'David']
    }
  ]

  describe('calculateConfidence', () => {
    it('should calculate confidence for well-structured content', () => {
      const content = `# Project Guidelines

## Overview
This document outlines the key guidelines for our project.

## Key Points
- Follow coding standards
- Write comprehensive tests
- Document all changes

## Conclusion
These guidelines ensure project quality.`

      const result = ConfidenceScoring.calculateConfidence(content, mockSourceMetadata)

      expect(result.score).toBeGreaterThan(0.7)
      expect(result.level).toBe('green')
      expect(result.factors.contentClarity).toBeGreaterThan(0.7)
      expect(result.factors.sourceConsistency).toBeGreaterThan(0.7)
      expect(result.reasoning).toContain('well-structured content')
    })

    it('should assign lower confidence to unstructured content', () => {
      const content = 'um yeah so like we need to do this thing and uh maybe that other thing too i guess'

      const result = ConfidenceScoring.calculateConfidence(content, mockSourceMetadata)

      expect(result.score).toBeLessThan(0.7)
      expect(result.level).toMatch(/^(yellow|red)$/)
      expect(result.factors.contentClarity).toBeLessThan(0.7)
      expect(result.reasoning).toMatch(/(yellow|red)/)
    })

    it('should handle single source appropriately', () => {
      const singleSource: SourceMetadata[] = [mockSourceMetadata[0]]
      const content = 'This is a clear, well-written document with proper structure.'

      const result = ConfidenceScoring.calculateConfidence(content, singleSource)

      expect(result.factors.sourceConsistency).toBe(0.7) // Single source gets moderate score
      expect(result.score).toBeGreaterThan(0.5)
    })

    it('should apply custom weights correctly', () => {
      const customWeights: ConfidenceWeights = {
        contentClarity: 0.5,
        sourceConsistency: 0.2,
        informationDensity: 0.2,
        authorityScore: 0.1
      }

      const content = `# Clear Document
This is well-structured content with good information density.`

      const result = ConfidenceScoring.calculateConfidence(
        content,
        mockSourceMetadata,
        undefined,
        customWeights
      )

      expect(result.score).toBeGreaterThan(0)
      expect(result.score).toBeLessThan(1)
    })

    it('should handle AI assessment input', () => {
      const aiAssessment = {
        factors: {
          contentClarity: 0.9,
          informationCompleteness: 0.8,
          languageQuality: 0.85,
          factualConsistency: 0.9,
          knowledgeBaseValue: 0.8
        }
      }

      const content = 'Test content'
      const result = ConfidenceScoring.calculateConfidence(
        content,
        mockSourceMetadata,
        aiAssessment
      )

      expect(result.factors.contentClarity).toBe(0.9) // Should use AI assessment
      expect(result.score).toBeGreaterThan(0.75)
    })
  })

  describe('createCustomWeights', () => {
    it('should create valid custom weights', () => {
      const weights = ConfidenceScoring.createCustomWeights(0.4, 0.3, 0.2, 0.1)

      expect(weights.contentClarity).toBe(0.4)
      expect(weights.sourceConsistency).toBe(0.3)
      expect(weights.informationDensity).toBe(0.2)
      expect(weights.authorityScore).toBe(0.1)
    })

    it('should throw error for invalid weights that do not sum to 1', () => {
      expect(() => {
        ConfidenceScoring.createCustomWeights(0.5, 0.3, 0.2, 0.2) // Sums to 1.2
      }).toThrow('Confidence weights must sum to 1.0')
    })
  })

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = ConfidenceScoring.calculateConfidence('', mockSourceMetadata)

      expect(result.score).toBeLessThan(0.6)
      expect(result.level).toMatch(/^(yellow|red)$/)
    })

    it('should handle very old sources', () => {
      const oldSources: SourceMetadata[] = [{
        type: 'teams',
        authorCount: 1,
        lastModified: new Date('2020-01-01'), // Very old
        participants: ['OldUser']
      }]

      const content = 'Well-structured content'
      const result = ConfidenceScoring.calculateConfidence(content, oldSources)

      expect(result.factors.authorityScore).toBeLessThan(0.6) // Should be penalized for age
    })

    it('should handle recent sources with high activity', () => {
      const recentSources: SourceMetadata[] = [{
        type: 'teams',
        authorCount: 5,
        messageCount: 50,
        lastModified: new Date(), // Very recent
        participants: ['User1', 'User2', 'User3', 'User4', 'User5']
      }]

      const content = 'Well-structured content'
      const result = ConfidenceScoring.calculateConfidence(content, recentSources)

      expect(result.factors.authorityScore).toBeGreaterThan(0.7) // Should get bonus for recency and activity
    })
  })
})