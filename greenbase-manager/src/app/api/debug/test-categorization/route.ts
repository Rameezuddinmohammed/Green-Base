import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing document categorization...')
    
    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get some sample documents
    const { data: documents, error } = await supabaseAdmin
      .from('approved_documents')
      .select('id, title, tags, summary')
      .limit(10)
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    // Test categorization logic
    const categories: { [key: string]: any[] } = {}
    
    documents?.forEach(doc => {
      let primaryCategory = 'General'
      
      // Combine all text for analysis
      const title = doc.title.toLowerCase()
      const tags = (doc.tags || []).map((tag: string) => tag.toLowerCase()).join(' ')
      const summary = (doc.summary || '').toLowerCase()
      const allText = `${title} ${tags} ${summary}`

      // Define specific category patterns (more granular)
      const specificPatterns = [
        // HR & People subcategories
        { category: 'Onboarding & Training', keywords: ['onboard', 'new hire', 'training', 'welcome', 'getting started', 'employee training'], priority: 10 },
        { category: 'Employee Policies', keywords: ['employee', 'hr', 'human resources', 'benefits', 'payroll', 'performance', 'hiring'], priority: 9 },
        
        // Policy subcategories
        { category: 'IT & Equipment Policies', keywords: ['laptop', 'equipment', 'it policy', 'computer', 'device', 'security training'], priority: 10 },
        { category: 'Expense & Finance Policies', keywords: ['expense', 'reimbursement', 'finance', 'budget', 'cost', 'business travel', 'payment'], priority: 10 },
        { category: 'Company Policies', keywords: ['policy', 'procedure', 'guideline', 'standard', 'protocol', 'company policy'], priority: 8 },
        
        // Compliance & Rules
        { category: 'Rules & Regulations', keywords: ['rule', 'regulation', 'compliance', 'legal', 'audit', 'requirement', 'official rules'], priority: 9 },
        
        // Technical & Product
        { category: 'Technical Documentation', keywords: ['technical', 'system', 'software', 'api', 'code', 'development', 'architecture', 'ai documentation'], priority: 7 },
        { category: 'Product & Tools', keywords: ['product', 'tool', 'platform', 'workflow automation', 'knowledge management'], priority: 6 },
        
        // Operations & Management
        { category: 'Operations & Management', keywords: ['operations', 'process', 'workflow', 'management', 'project', 'planning'], priority: 5 },
        
        // Events & Activities
        { category: 'Events & Activities', keywords: ['event', 'competition', 'activity', 'meeting', 'conference'], priority: 4 }
      ]

      // First, try to create very specific subcategories based on content
      let specificSubcategory = ''
      
      // Look for specific policy types
      if (allText.includes('laptop') || allText.includes('equipment') || allText.includes('device')) {
        if (allText.includes('policy')) specificSubcategory = 'Laptop & Equipment Policies'
      } else if (allText.includes('expense') || allText.includes('reimbursement')) {
        if (allText.includes('policy')) specificSubcategory = 'Expense & Reimbursement Policies'
      } else if (allText.includes('holiday') || allText.includes('vacation') || allText.includes('leave')) {
        if (allText.includes('policy')) specificSubcategory = 'Holiday & Leave Policies'
      } else if (allText.includes('onboard') && (allText.includes('plan') || allText.includes('process'))) {
        specificSubcategory = 'Onboarding Plans & Processes'
      } else if (allText.includes('training') && allText.includes('new hire')) {
        specificSubcategory = 'New Hire Training'
      } else if (allText.includes('rule') && allText.includes('regulation')) {
        specificSubcategory = 'Official Rules & Regulations'
      } else if (allText.includes('ai') && allText.includes('documentation')) {
        specificSubcategory = 'AI & Automation Tools'
      }

      // If we found a specific subcategory, use it
      if (specificSubcategory) {
        primaryCategory = specificSubcategory
      } else {
        // Otherwise, find the best matching broad category
        let highestPriority = 0
        
        for (const pattern of specificPatterns) {
          // Check if any keywords match in title, tags, or summary
          const matchCount = pattern.keywords.filter(keyword => allText.includes(keyword)).length
          
          if (matchCount > 0) {
            // Calculate score based on match count and priority
            const score = matchCount * pattern.priority
            
            if (score > highestPriority) {
              primaryCategory = pattern.category
              highestPriority = score
            }
          }
        }
        
        // If still no specific match, use broader categories
        if (highestPriority === 0) {
        if (allText.includes('policy') || allText.includes('procedure') || allText.includes('guideline')) {
          primaryCategory = 'Company Policies'
        } else if (allText.includes('employee') || allText.includes('hr') || allText.includes('human')) {
          primaryCategory = 'Employee Policies'
        } else if (allText.includes('technical') || allText.includes('system') || allText.includes('software')) {
          primaryCategory = 'Technical Documentation'
        } else if (allText.includes('finance') || allText.includes('expense') || allText.includes('budget')) {
          primaryCategory = 'Finance & Operations'
        } else if (allText.includes('training') || allText.includes('onboard') || allText.includes('guide')) {
          primaryCategory = 'Training & Guides'
        } else {
          // Fallback: use the first tag as category if available
          if (doc.tags && doc.tags.length > 0) {
            primaryCategory = doc.tags[0]
          }
        }
        }
      }

      // Add document to its primary category
      if (!categories[primaryCategory]) {
        categories[primaryCategory] = []
      }
      categories[primaryCategory].push({
        id: doc.id,
        title: doc.title,
        tags: doc.tags,
        summary: doc.summary,
        matchedText: allText.substring(0, 100) + '...'
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Categorization test completed',
      totalDocuments: documents?.length || 0,
      categories: Object.entries(categories).map(([name, docs]) => ({
        name,
        documentCount: docs.length,
        documents: docs
      })).sort((a, b) => b.documentCount - a.documentCount)
    })

  } catch (error: any) {
    console.error('❌ Categorization test failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}