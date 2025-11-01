import { NextRequest, NextResponse } from 'next/server'
import { ConfidenceScoring } from '../../../../lib/ai/confidence-scoring'
import { PromptTemplates } from '../../../../lib/ai/prompt-templates'
import { getAzureOpenAIService } from '../../../../lib/ai/azure-openai'

export async function POST(request: NextRequest) {
  try {
    const { content, testWithAI = true } = await request.json()
    
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    let aiAssessment = undefined

    if (testWithAI) {
      console.log('🤖 Testing with full AI assessment...')
      try {
        // Get AI assessment for confidence factors using dynamic scoring
        const openAIService = getAzureOpenAIService()
        const confidencePrompt = PromptTemplates.dynamicConfidenceScoring({
          structuredContent: content,
          sourceQuality: 0.5,
          contentLength: content.length,
          sourceCount: 1,
          documentType: 'Test Document',
          heuristicData: {
            clarityIndicators: 'basic structure',
            informationDensity: '50% unique words',
            sourceConsistency: 'single source',
            authorityIndicators: 'test content',
            detectedIssues: ['short content']
          }
        })
        
        const confidenceResult = await openAIService.chatCompletion([
          { role: 'system', content: confidencePrompt.system },
          { role: 'user', content: confidencePrompt.user }
        ], { temperature: 0.1, maxTokens: 300 })

        console.log('Raw AI Response:', confidenceResult.content)

        // Parse AI confidence assessment
        try {
          let jsonContent = confidenceResult.content.trim()
          
          // If response contains markdown code blocks, extract the JSON
          const jsonMatch = jsonContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
          if (jsonMatch) {
            jsonContent = jsonMatch[1]
          }
          
          // Find JSON object even if there's text before/after
          const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/)
          if (jsonObjectMatch) {
            jsonContent = jsonObjectMatch[0]
          }

          const parsed = JSON.parse(jsonContent)
          console.log('✓ AI Assessment Parsed Successfully:', parsed)
          
          // Handle both old and new response formats
          if (parsed.overallConfidence && typeof parsed.overallConfidence === 'number') {
            // New dynamic format
            aiAssessment = {
              overallScore: Math.min(1, Math.max(0, parsed.overallConfidence)),
              factors: {
                contentClarity: typeof parsed.factors?.contentClarity === 'number' 
                  ? Math.min(1, Math.max(0, parsed.factors.contentClarity))
                  : undefined,
                sourceConsistency: typeof parsed.factors?.factualConsistency === 'number'
                  ? Math.min(1, Math.max(0, parsed.factors.factualConsistency))
                  : undefined,
                informationDensity: typeof parsed.factors?.informationCompleteness === 'number'
                  ? Math.min(1, Math.max(0, parsed.factors.informationCompleteness))
                  : undefined,
                authorityScore: typeof parsed.factors?.professionalStandards === 'number'
                  ? Math.min(1, Math.max(0, parsed.factors.professionalStandards))
                  : undefined
              },
              reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
              recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : undefined,
              confidenceLevel: typeof parsed.confidenceLevel === 'string' ? parsed.confidenceLevel : undefined
            }
          } else {
            // Legacy format
            aiAssessment = {
              factors: {
                contentClarity: typeof parsed.factors.contentClarity === 'number' 
                  ? parsed.factors.contentClarity 
                  : undefined,
                sourceConsistency: typeof parsed.factors.factualConsistency === 'number'
                  ? parsed.factors.factualConsistency 
                  : undefined,
                informationDensity: typeof parsed.factors.informationCompleteness === 'number'
                  ? parsed.factors.informationCompleteness 
                  : undefined,
                authorityScore: typeof parsed.overallConfidence === 'number'
                  ? parsed.overallConfidence 
                  : undefined
              },
              reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined
            }
          }
          
          console.log('✓ Mapped AI Assessment:', aiAssessment)
        } catch (parseError) {
          console.warn('✗ Failed to parse AI confidence assessment:', parseError)
          console.log('Raw AI Response:', confidenceResult.content)
          aiAssessment = undefined
        }
      } catch (aiError) {
        console.error('AI assessment failed:', aiError)
        aiAssessment = undefined
      }
    }

    // Test the confidence scoring with or without AI assessment
    const result = ConfidenceScoring.calculateConfidence(content, [], aiAssessment)
    
    return NextResponse.json({
      score: result.score,
      level: result.level,
      reasoning: result.reasoning,
      factors: result.factors,
      aiAssessment: aiAssessment,
      usedAI: !!aiAssessment
    })
  } catch (error: any) {
    console.error('Test confidence error:', error)
    return NextResponse.json(
      { error: 'Failed to test confidence', details: error.message },
      { status: 500 }
    )
  }
}