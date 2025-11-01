import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import ConfidenceScoring from '../../../../lib/ai/confidence-scoring'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Recalculating confidence scores...')
    
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user's organization
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', session.user.id)
      .single()

    if (!user && session.user.email) {
      const { data: userByEmail } = await supabaseAdmin
        .from('users')
        .select('organization_id, role')
        .eq('email', session.user.email)
        .single()
      user = userByEmail
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all pending draft documents for the organization
    const { data: drafts, error: draftsError } = await supabaseAdmin
      .from('draft_documents')
      .select(`
        id, title, content, confidence_score, triage_level, confidence_reasoning,
        source_references, created_at
      `)
      .eq('organization_id', user.organization_id)
      .eq('status', 'pending')

    if (draftsError) {
      throw draftsError
    }

    console.log(`📊 Found ${drafts?.length || 0} pending drafts to recalculate`)

    const results = []
    let updated = 0

    for (const draft of drafts || []) {
      try {
        // Get source documents for this draft
        const { data: sourceDocs } = await supabaseAdmin
          .from('source_documents')
          .select('original_content, source_type, metadata')
          .eq('draft_document_id', draft.id)

        // Analyze original source quality
        const originalContent = sourceDocs?.[0]?.original_content || ''
        const originalSourceQuality = ConfidenceScoring.analyzeOriginalSourceQuality(originalContent)

        // Create source metadata
        const sourceMetadata = [{
          type: sourceDocs?.[0]?.source_type || 'google_drive',
          authorCount: 1,
          lastModified: new Date(draft.created_at),
          participants: []
        }]

        // Recalculate confidence
        const newConfidence = ConfidenceScoring.calculateConfidence(
          draft.content,
          sourceMetadata,
          undefined, // No AI assessment
          originalSourceQuality
        )

        const oldScore = parseFloat(draft.confidence_score)
        const scoreChange = newConfidence.score - oldScore
        const levelChanged = newConfidence.level !== draft.triage_level

        // Update the document
        const { error: updateError } = await supabaseAdmin
          .from('draft_documents')
          .update({
            confidence_score: newConfidence.score,
            triage_level: newConfidence.level,
            confidence_reasoning: newConfidence.reasoning
          })
          .eq('id', draft.id)

        if (updateError) {
          console.error(`Failed to update draft ${draft.id}:`, updateError)
          results.push({
            id: draft.id,
            title: draft.title,
            error: updateError.message
          })
        } else {
          updated++
          results.push({
            id: draft.id,
            title: draft.title,
            oldScore: Math.round(oldScore * 100),
            newScore: Math.round(newConfidence.score * 100),
            scoreChange: Math.round(scoreChange * 100),
            oldLevel: draft.triage_level,
            newLevel: newConfidence.level,
            levelChanged,
            sourceQuality: originalSourceQuality.rawContentQualityLevel
          })
        }

        console.log(`📈 ${draft.title}: ${Math.round(oldScore * 100)}% → ${Math.round(newConfidence.score * 100)}% (${draft.triage_level} → ${newConfidence.level})`)

      } catch (error: any) {
        console.error(`Error processing draft ${draft.id}:`, error)
        results.push({
          id: draft.id,
          title: draft.title,
          error: error.message
        })
      }
    }

    console.log(`✅ Recalculation complete: ${updated}/${drafts?.length || 0} documents updated`)

    return NextResponse.json({
      success: true,
      message: `Recalculated confidence scores for ${updated} documents`,
      totalDocuments: drafts?.length || 0,
      updatedDocuments: updated,
      results
    })

  } catch (error: any) {
    console.error('❌ Confidence recalculation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to recalculate confidence scores', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}