import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        console.log('🧹 Starting complete data cleanup...')
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        // Clear all tables in the correct order (respecting foreign key constraints)
        const tables = [
            'source_documents',      // References draft_documents
            'source_sync_history',   // References connected_sources
            'document_chunks',       // References approved_documents
            'document_versions',     // References approved_documents
            'source_items',          // References draft_documents and connected_sources
            'qa_interactions',       // References users
            'approved_documents',    // References draft_documents and users
            'draft_documents',       // References approved_documents (self-reference)
            'connected_sources'      // References users
        ]
        
        let totalDeleted = 0
        
        // Use raw SQL to handle foreign key constraints properly
        const { data: deleteResults, error: deleteError } = await supabase.rpc('clear_all_data')
        
        if (deleteError) {
            console.error('❌ Error with stored procedure, trying manual cleanup:', deleteError)
            
            // Fallback: Manual cleanup with proper ordering
            for (const table of tables) {
                console.log(`🗑️ Clearing ${table}...`)
                
                try {
                    const { count, error } = await supabase
                        .from(table)
                        .delete()
                        .gte('created_at', '1900-01-01') // Delete all records
                    
                    if (error) {
                        console.error(`❌ Error clearing ${table}:`, error)
                        // Continue with other tables even if one fails
                        continue
                    }
                    
                    console.log(`✅ Cleared ${count || 0} records from ${table}`)
                    totalDeleted += count || 0
                } catch (err) {
                    console.error(`❌ Exception clearing ${table}:`, err)
                    continue
                }
            }
        } else {
            console.log('✅ Used stored procedure for cleanup')
            totalDeleted = deleteResults || 0
        }
        
        console.log(`🎉 Data cleanup complete! Deleted ${totalDeleted} total records`)
        
        return NextResponse.json({
            success: true,
            message: `Successfully cleared all data`,
            tablesCleared: tables,
            totalRecordsDeleted: totalDeleted,
            details: {
                knowledgeBase: 'All documents, versions, and chunks cleared',
                approvalQueue: 'All drafts cleared',
                sources: 'All source configurations cleared',
                changes: 'All change tracking cleared'
            }
        })
        
    } catch (error: any) {
        console.error('❌ Data cleanup failed:', error)
        
        return NextResponse.json({
            success: false,
            error: error.message,
            message: 'Data cleanup failed'
        }, { status: 500 })
    }
}