import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../lib/supabase-admin'
import { ConfidenceScoring } from '../../../lib/ai/confidence-scoring'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = await getSupabaseAdmin()

    // Get all pending draft documents with source documents
    const { data: drafts, error } = await supabaseAdmin
      .from('draft_documents')
      .select(`
        id,
        title,
        content,
        confidence_score,
        triage_level,
        source_documents (
          id,
          source_type,
          source_id,
          original_content,
          metadata
        )
      `)
      .eq('status', 'pending')

    if (error) {
      throw error
    }

    let updatedCount = 0
    const results = []

    for (const draft of drafts || []) {
      try {
        // Get original raw content from source documents
        const rawContent = (draft.source_documents || [])
          .map((source: any) => source.original_content || '')
          .join('\n\n')

        if (!rawContent || rawContent.trim().length === 0) {
          console.log(`Skipping draft ${draft.id}: No original content available`)
          continue
        }

        // Analyze original source quality using new hybrid method
        const originalSourceQuality = ConfidenceScoring.analyzeOriginalSourceQuality(rawContent)
        console.log(`Draft ${draft.id} source quality:`, originalSourceQuality)

        // Prepare source metadata for confidence calculation
        const sourceMetadata = (draft.source_documents || []).map((source: any) => ({
          type: source.source_type as 'teams' | 'google_drive',
          authorCount: source.metadata?.author ? 1 : 0,
          messageCount: source.source_type === 'teams' ? 1 : undefined,
          fileSize: rawContent.length,
          lastModified: source.metadata?.createdAt ? new Date(source.metadata.createdAt) : new Date(),
          participants: source.metadata?.author ? [source.metadata.author] : []
        }))

        // Recalculate confidence using new hybrid logic with source quality analysis
        const newConfidence = ConfidenceScoring.calculateConfidence(
          draft.content || '',
          sourceMetadata,
          undefined, // No AI assessment for recalculation
          originalSourceQuality // NEW: Include original source quality
        )

        const oldScore = parseFloat(draft.confidence_score)
        const newScore = newConfidence.score
        const newTriageLevel = newConfidence.level

        // Update the database
        await supabaseAdmin
          .from('draft_documents')
          .update({
            confidence_score: newScore,
            confidence_reasoning: newConfidence.reasoning,
            triage_level: newTriageLevel
          })
          .eq('id', draft.id)

        results.push({
          id: draft.id,
          title: draft.title.substring(0, 50) + '...',
          oldScore: Math.round(oldScore * 100),
          newScore: Math.round(newScore * 100),
          oldLevel: draft.triage_level,
          newLevel: newTriageLevel,
          change: Math.round((newScore - oldScore) * 100),
          sourceQuality: originalSourceQuality.rawContentQualityLevel,
          sourceLength: originalSourceQuality.rawContentLength,
          penalty: newConfidence.sourceQualityPenalty ? Math.round(newConfidence.sourceQualityPenalty * 100) : 0
        })

        updatedCount++
      } catch (error) {
        console.error(`Failed to update draft ${draft.id}:`, error)
        results.push({
          id: draft.id,
          title: 'Error processing',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Sort results by change (most negative first to see biggest penalties)
    results.sort((a, b) => (a.change || 0) - (b.change || 0))

    return NextResponse.json({ 
      success: true, 
      message: `Recalculated hybrid scores for ${updatedCount} documents`,
      updatedCount,
      results: results.slice(0, 15), // Show top 15 changes
      summary: {
        totalProcessed: results.length,
        avgChange: results.reduce((sum, r) => sum + (r.change || 0), 0) / results.length,
        penaltiesApplied: results.filter(r => r.penalty > 0).length
      }
    })

  } catch (error: any) {
    console.error('Recalculate hybrid scores error:', error)
    return NextResponse.json(
      { error: 'Failed to recalculate hybrid scores', details: error.message },
      { status: 500 }
    )
  }
}