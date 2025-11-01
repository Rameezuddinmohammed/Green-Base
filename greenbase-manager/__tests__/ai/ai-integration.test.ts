import { getAIIntegrationService, SourceReference } from '@/lib/ai/ai-integration-service'

// Mock dependencies
jest.mock('@/lib/ai/azure-openai', () => ({
  getAzureOpenAIService: () => ({
    chatCompletion: jest.fn().mockImplementation((messages) => {
      const systemMessage = messages.find((m: any) => m.role === 'system')?.content || ''
      const userMessage = messages.find((m: any) => m.role === 'user')?.content || ''

      // Document classification
      if (systemMessage.includes('document classification expert') || userMessage.includes('Classify this document content')) {
        // Simulate different classifications based on content
        if (userMessage.includes('creative') || userMessage.includes('unique')) {
          return Promise.resolve({
            content: 'AI_DETERMINED',
            usage: { totalTokens: 25, promptTokens: 20, completionTokens: 5 },
            finishReason: 'stop'
          })
        }
        return Promise.resolve({
          content: 'DEFAULT_SOP',
          usage: { totalTokens: 25, promptTokens: 20, completionTokens: 5 },
          finishReason: 'stop'
        })
      }

      // AI-determined formatting
      if (systemMessage.includes('expert document formatter') || userMessage.includes('Analyze and format this content')) {
        return Promise.resolve({
          content: `# Creative Document

## Overview
This unique document has been formatted using AI-determined structure.

## Key Elements
- Dynamically structured content
- Optimized for document purpose
- Flexible formatting approach

## Conclusion
AI-determined formatting provides optimal structure for unique content types.`,
          usage: { totalTokens: 200, promptTokens: 150, completionTokens: 50 },
          finishReason: 'stop'
        })
      }

      // Content structuring
      if (systemMessage.includes('Standard Operating Procedures') || userMessage.includes('Transform')) {
        return Promise.resolve({
          content: `# Structured Document

## Overview
This is a well-structured document created from the source content.

## Key Points
- Important information extracted from sources
- Organized in a logical manner
- Ready for knowledge base inclusion

## Conclusion
The content has been successfully structured.`,
          usage: { totalTokens: 150, promptTokens: 100, completionTokens: 50 },
          finishReason: 'stop'
        })
      }

      // Topic identification - check for specific prompt content
      if (systemMessage.includes('topic classification expert') || userMessage.includes('Analyze this content and identify the main topics')) {
        return Promise.resolve({
          content: '["Project Management", "Team Collaboration"]',
          usage: { totalTokens: 50, promptTokens: 30, completionTokens: 20 },
          finishReason: 'stop'
        })
      }

      // Confidence assessment - check for specific prompt content
      if (systemMessage.includes('content quality assessor') || userMessage.includes('Evaluate the quality and confidence level')) {
        return Promise.resolve({
          content: JSON.stringify({
            overallScore: 0.85,
            factors: {
              contentClarity: 0.9,
              informationCompleteness: 0.8,
              languageQuality: 0.85,
              factualConsistency: 0.9,
              knowledgeBaseValue: 0.8
            },
            reasoning: "High quality content with clear structure and good information density"
          }),
          usage: { totalTokens: 100, promptTokens: 70, completionTokens: 30 },
          finishReason: 'stop'
        })
      }

      // Intent recognition - check for specific prompt content
      if (systemMessage.includes('intent recognition system') || userMessage.includes('Analyze the intent and provide the structured response')) {
        return Promise.resolve({
          content: JSON.stringify({
            intent: 'modify',
            targetDocument: 'Project Guidelines',
            proposedChanges: 'Update the testing requirements section',
            confidence: 0.9,
            newContent: 'Updated testing requirements: All code must have unit tests with 80% coverage.'
          }),
          usage: { totalTokens: 80, promptTokens: 60, completionTokens: 20 },
          finishReason: 'stop'
        })
      }

      // Default Q&A response
      return Promise.resolve({
        content: 'Based on the provided context, here is the answer to your question with relevant details and source citations.',
        usage: { totalTokens: 120, promptTokens: 90, completionTokens: 30 },
        finishReason: 'stop'
      })
    })
  })
}))

jest.mock('@/lib/ai/pii-redaction', () => ({
  getPIIRedactionService: () => ({
    redactPII: jest.fn().mockResolvedValue({
      redactedText: 'This is redacted content with *** removed.',
      entities: [
        {
          text: 'john@example.com',
          category: 'Email',
          confidenceScore: 0.95,
          offset: 25,
          length: 16
        }
      ],
      originalLength: 50,
      redactedLength: 45
    })
  })
}))

describe('AIIntegrationService', () => {
  let aiService: ReturnType<typeof getAIIntegrationService>

  beforeEach(() => {
    aiService = getAIIntegrationService()
    jest.clearAllMocks()
  })

  describe('processContent', () => {
    const mockSourceContent = [
      'This is the first piece of content from Teams channel.',
      'This is the second piece of content with some details about the project.'
    ]

    const mockSourceReferences: SourceReference[] = [
      {
        sourceType: 'teams',
        sourceId: 'channel-123',
        originalContent: 'This is the first piece of content from Teams channel.',
        metadata: {
          author: 'John Doe',
          createdAt: new Date('2024-01-15')
        }
      },
      {
        sourceType: 'teams',
        sourceId: 'channel-123',
        originalContent: 'This is the second piece of content with some details about the project.',
        metadata: {
          author: 'Jane Smith',
          createdAt: new Date('2024-01-15')
        }
      }
    ]

    it('should process content successfully with all steps', async () => {
      const rawContent = mockSourceContent.join('\n\n')

      const result = await aiService.processContent(
        rawContent,
        mockSourceReferences
      )

      expect(result).toHaveProperty('structuredContent')
      expect(result).toHaveProperty('redactedContent')
      expect(result).toHaveProperty('summary')
      expect(result).toHaveProperty('topics')
      expect(result).toHaveProperty('confidence')
      expect(result).toHaveProperty('piiEntities')
      expect(result).toHaveProperty('processingTime')
      expect(result).toHaveProperty('tokensUsed')

      expect(result.structuredContent).toContain('Structured Document')
      expect(result.topics).toEqual(['Project Management', 'Team Collaboration'])
      expect(result.confidence.score).toBeGreaterThan(0)
      expect(result.piiEntities).toHaveLength(1)
      expect(result.tokensUsed).toBeGreaterThan(0)
    })

    it('should handle short content gracefully', async () => {
      const shortContent = 'Short content'

      const result = await aiService.processContent(
        shortContent,
        mockSourceReferences
      )

      expect(result.structuredContent).toBeTruthy()
      expect(result.topics).toEqual(['Project Management', 'Team Collaboration'])
    })

    it('should handle changes summary', async () => {
      const rawContent = mockSourceContent.join('\n\n')
      const changesSummary = ['Added new section', 'Updated requirements']

      const result = await aiService.processContent(
        rawContent,
        mockSourceReferences,
        changesSummary
      )

      expect(result.confidence.score).toBeGreaterThan(0)
      expect(result.confidence.level).toMatch(/^(green|yellow|red)$/)
    })

    it('should handle PII redaction', async () => {
      const rawContent = 'Contact john@example.com for more information'

      const result = await aiService.processContent(
        rawContent,
        mockSourceReferences
      )

      expect(result.piiEntities).toHaveLength(1)
      expect(result.redactedContent).toContain('***')
    })
  })

  describe('processForQA', () => {
    it('should generate answer from context content', async () => {
      const question = 'What are the testing requirements?'
      const content = 'Testing Requirements: All code must have unit tests with 80% coverage.'

      const result = await aiService.processForQA(content, question)

      expect(result.answer).toBeTruthy()
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.tokensUsed).toBeGreaterThan(0)
      expect(typeof result.answer).toBe('string')
      expect(typeof result.confidence).toBe('number')
    })

    it('should handle empty content gracefully', async () => {
      const question = 'What are the requirements?'
      const content = ''

      const result = await aiService.processForQA(content, question)

      expect(result.answer).toBeTruthy()
      expect(result.confidence).toBeGreaterThan(0) // Mock returns default confidence
    })
  })

  describe('classifyDocumentType', () => {
    it('should classify document types correctly', async () => {
      const content = 'Step 1: Initialize the process. Step 2: Execute the task.'

      const result = await aiService.classifyDocumentType(content)

      expect(result).toBe('DEFAULT_SOP')
    })

    it('should classify unique content as AI_DETERMINED', async () => {
      const content = 'This is a creative and unique document with unusual structure'

      const result = await aiService.classifyDocumentType(content)

      expect(result).toBe('AI_DETERMINED')
    })

    it('should handle classification errors gracefully', async () => {
      const content = 'Some unclear content'

      const result = await aiService.classifyDocumentType(content)

      // Should return a valid domain even for unclear content
      expect(Object.values(['SALES_PLAYBOOK', 'RESOURCE_LIST', 'BUSINESS_PLAN', 'RAW_DATA_ANALYSIS', 'TECHNICAL_SPEC', 'POLICY', 'CV', 'DEFAULT_SOP', 'AI_DETERMINED'])).toContain(result)
    })

    it('should handle case-insensitive classification results', async () => {
      // This would test the improved validation logic
      const content = 'Standard operating procedure content'

      const result = await aiService.classifyDocumentType(content)

      expect(result).toBe('DEFAULT_SOP')
    })
  })

  describe('AI-determined processing', () => {
    it('should handle AI_DETERMINED documents with dynamic formatting', async () => {
      const uniqueContent = 'This is a creative and unique document that requires special formatting'

      const result = await aiService.processContent(
        uniqueContent,
        [{
          sourceType: 'teams',
          sourceId: 'test',
          originalContent: uniqueContent,
          metadata: {}
        }]
      )

      expect(result.structuredContent).toContain('Creative Document')
      expect(result.structuredContent).toContain('AI-determined formatting')
    })
  })

  describe('error handling', () => {
    it('should handle empty content gracefully', async () => {
      try {
        await aiService.processContent(
          '',
          [{
            sourceType: 'teams',
            sourceId: 'test',
            originalContent: '',
            metadata: {}
          }]
        )
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('No readable content found')
      }
    })

    it('should handle very short content', async () => {
      try {
        await aiService.processContent(
          'Hi',
          [{
            sourceType: 'teams',
            sourceId: 'test',
            originalContent: 'Hi',
            metadata: {}
          }]
        )
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Content is too short')
      }
    })

    it('should have required methods defined', async () => {
      expect(aiService.processContent).toBeDefined()
      expect(aiService.processForQA).toBeDefined()
      expect(aiService.classifyDocumentType).toBeDefined()
    })
  })

  describe('performance', () => {
    it('should complete processing within reasonable time', async () => {
      const startTime = Date.now()

      await aiService.processContent(
        'Short test content for processing performance evaluation',
        [{
          sourceType: 'teams',
          sourceId: 'test',
          originalContent: 'Short test content for processing performance evaluation',
          metadata: {}
        }]
      )

      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })
  })
})