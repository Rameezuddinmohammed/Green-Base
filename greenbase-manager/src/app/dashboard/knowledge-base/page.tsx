"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BookOpen,
  Search,
  TreePine,
  Grid3X3,
  CheckCircle,
  Share,
  FileText
} from "lucide-react"

import { HierarchicalBrowser } from "@/components/knowledge-base/hierarchical-browser"
import { DocumentViewer } from "@/components/knowledge-base/document-viewer"

interface KBDocument {
  id: string
  title: string
  content: string
  summary: string
  tags: string[]
  created_at: string
  updated_at: string
  approved_by: string
  version: number
  type: 'document'
  approver?: {
    email: string
  }
}

interface Category {
  id: string
  name: string
  type: 'category'
  children: KBDocument[]
}

export default function KnowledgeBasePage() {
  const [hierarchicalData, setHierarchicalData] = useState<Category[]>([])
  const [flatDocuments, setFlatDocuments] = useState<KBDocument[]>([])
  const [allDocuments, setAllDocuments] = useState<KBDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<KBDocument | null>(null)
  const [viewMode, setViewMode] = useState<'browse' | 'document'>('browse')
  const [activeTab, setActiveTab] = useState<'hierarchical' | 'grid'>('hierarchical')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadKnowledgeBase()
  }, [])

  const loadKnowledgeBase = async () => {
    try {
      setLoading(true)
      console.log('🔄 Loading knowledge base...')

      const response = await fetch('/api/knowledge-base')
      console.log('📡 Knowledge base API response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('📚 Knowledge base API response:', data)
        const documents = data.documents || []
        console.log('📄 Found documents:', documents.length, documents)

        setAllDocuments(documents)
        setFlatDocuments(documents)

        const categorizedDocs = groupDocumentsByTags(documents)
        console.log('🏷️ Categorized documents:', categorizedDocs)
        setHierarchicalData(categorizedDocs)
      } else {
        let errorData
        try {
          errorData = await response.json()
        } catch (parseError) {
          errorData = { error: 'Failed to parse error response', status: response.status }
        }
        console.error('❌ Knowledge base API error:', response.status, errorData)
        console.error('❌ Response details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          url: response.url
        })
      }
    } catch (error) {
      console.error('❌ Failed to load knowledge base:', error)
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    } finally {
      setLoading(false)
    }
  }

  const groupDocumentsByTags = (documents: KBDocument[]): Category[] => {
    if (!documents || documents.length === 0) {
      return []
    }

    const categories: { [key: string]: KBDocument[] } = {}

    // Smart categorization: assign each document to ONE specific category
    documents.forEach(doc => {
      let primaryCategory = 'General Documents'

      // First, check if document already has a smart category from AI (preferred)
      if (doc.tags && doc.tags.length > 0) {
        // Use the first tag as the primary category if it looks like a smart category
        const firstTag = doc.tags[0]
        if (firstTag && firstTag !== 'general' && firstTag.length > 3) {
          primaryCategory = firstTag
        }
      }

      // If no good tag found, analyze content for smart categorization
      if (primaryCategory === 'General Documents') {
        // Combine all text for analysis
        const title = doc.title.toLowerCase()
        const tags = (doc.tags || []).map(tag => tag.toLowerCase()).join(' ')
        const summary = (doc.summary || '').toLowerCase()
        const allText = `${title} ${tags} ${summary}`

        // Create very specific subcategories based on content
        if (allText.includes('laptop') || allText.includes('equipment') || allText.includes('device')) {
          if (allText.includes('policy')) primaryCategory = 'Laptop & Equipment Policies'
          else primaryCategory = 'IT & Equipment'
        } else if (allText.includes('expense') || allText.includes('reimbursement')) {
          if (allText.includes('policy')) primaryCategory = 'Expense & Reimbursement Policies'
          else primaryCategory = 'Finance & Operations'
        } else if (allText.includes('holiday') || allText.includes('vacation') || allText.includes('leave')) {
          if (allText.includes('policy')) primaryCategory = 'Holiday & Leave Policies'
          else primaryCategory = 'Employee Policies'
        } else if (allText.includes('onboard') && (allText.includes('plan') || allText.includes('process'))) {
          primaryCategory = 'Onboarding Plans & Processes'
        } else if (allText.includes('training') && allText.includes('new hire')) {
          primaryCategory = 'New Hire Training'
        } else if (allText.includes('rule') && allText.includes('regulation')) {
          primaryCategory = 'Official Rules & Regulations'
        } else if (allText.includes('ai') && allText.includes('documentation')) {
          primaryCategory = 'AI & Automation Tools'
        } else if (allText.includes('onboard') || allText.includes('training') || allText.includes('new hire')) {
          primaryCategory = 'Onboarding & Training'
        } else if (allText.includes('expense') || allText.includes('reimbursement') || allText.includes('finance')) {
          primaryCategory = 'Finance & Operations'
        } else if (allText.includes('policy') || allText.includes('procedure') || allText.includes('guideline')) {
          primaryCategory = 'Company Policies'
        } else if (allText.includes('rule') || allText.includes('regulation') || allText.includes('compliance')) {
          primaryCategory = 'Rules & Regulations'
        } else if (allText.includes('technical') || allText.includes('system') || allText.includes('software')) {
          primaryCategory = 'Technical Documentation'
        } else if (allText.includes('employee') || allText.includes('hr') || allText.includes('human')) {
          primaryCategory = 'Employee Policies'
        } else if (allText.includes('event') || allText.includes('competition') || allText.includes('activity')) {
          primaryCategory = 'Events & Activities'
        } else {
          // Final fallback: try to extract meaningful category from title
          const titleWords = doc.title.toLowerCase().split(/\s+/)
          const meaningfulWords = titleWords.filter(word =>
            word.length > 3 &&
            !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'our'].includes(word)
          )

          if (meaningfulWords.length > 0) {
            primaryCategory = meaningfulWords[0].charAt(0).toUpperCase() + meaningfulWords[0].slice(1) + ' Documents'
          }
        }
      }

      // Add document to its primary category
      if (!categories[primaryCategory]) {
        categories[primaryCategory] = []
      }
      categories[primaryCategory].push(doc)
    })

    // Define category priority for sorting
    const categoryPriority: { [key: string]: number } = {
      'Laptop & Equipment Policies': 12,
      'Expense & Reimbursement Policies': 12,
      'Holiday & Leave Policies': 12,
      'Onboarding Plans & Processes': 11,
      'New Hire Training': 11,
      'Official Rules & Regulations': 11,
      'AI & Automation Tools': 10,
      'Onboarding & Training': 10,
      'Employee Policies': 9,
      'Rules & Regulations': 9,
      'Company Policies': 8,
      'Technical Documentation': 7,
      'Finance & Operations': 7,
      'IT & Equipment': 6,
      'Product & Tools': 6,
      'Operations & Management': 5,
      'Events & Activities': 4,
      'General Documents': 1
    }

    // Sort categories by priority first, then by document count
    const sortedCategories = Object.entries(categories)
      .sort(([nameA, docsA], [nameB, docsB]) => {
        const priorityA = categoryPriority[nameA] || 0
        const priorityB = categoryPriority[nameB] || 0

        if (priorityA !== priorityB) {
          return priorityB - priorityA
        }

        return docsB.length - docsA.length
      })
      .map(([name, children]) => ({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        type: 'category' as const,
        children: children.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      }))
      .filter(category => category.children.length > 0)

    console.log('📊 Categorized documents:', sortedCategories.map(cat => `${cat.name}: ${cat.children.length}`))
    return sortedCategories
  }

  const handleDocumentSelect = (document: KBDocument | any) => {
    setSelectedDocument(document)
    setViewMode('document')
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      setFlatDocuments(allDocuments)
      setHierarchicalData(groupDocumentsByTags(allDocuments))
      return
    }

    const filtered = allDocuments.filter(doc =>
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.content.toLowerCase().includes(query.toLowerCase()) ||
      doc.summary.toLowerCase().includes(query.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    )

    setFlatDocuments(filtered)
    setHierarchicalData(groupDocumentsByTags(filtered))
    console.log(`🔍 Filtered ${filtered.length} documents for "${query}"`)
  }

  const handleBackToKnowledgeBase = () => {
    setSelectedDocument(null)
    setViewMode('browse')
  }

  const handleAutoCategorize = async () => {
    try {
      setLoading(true)
      console.log('🧠 Starting automatic categorization...')

      const response = await fetch('/api/knowledge-base/auto-categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Auto-categorization result:', result)

        // Reload the knowledge base to show the new categories
        await loadKnowledgeBase()

        // Show success message
        console.log(`🎉 Successfully organized ${result.categorized} documents into categories!`)
      } else {
        const error = await response.json()
        console.error('❌ Auto-categorization failed:', error)
      }
    } catch (error) {
      console.error('❌ Auto-categorization error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  // Document viewer mode
  if (viewMode === 'document' && selectedDocument) {
    return (
      <DashboardLayout>
        <div className="container py-8 px-4">
          <DocumentViewer
            documentId={selectedDocument.id}
            onBack={handleBackToKnowledgeBase}
          />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Main Content Area - Full Width */}
        <div className="flex-1 min-w-0">
          <div className="h-full px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
                <p className="text-muted-foreground mt-2">
                  Your centralized repository of approved, living documentation
                </p>
              </div>

              {/* Auto-categorize button - only show if we have uncategorized documents */}
              {allDocuments.length > 0 && hierarchicalData.length === 0 && (
                <Button
                  onClick={handleAutoCategorize}
                  disabled={loading}
                  className="flex items-center"
                  variant="outline"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Organizing Documents...
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Auto-Organize Documents
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Search and Navigation */}
            <div className="flex items-center gap-6 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documents by title, content, or tags..."
                  className="w-full pl-11 pr-4 py-3 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => handleSearch('')}
                  >
                    ×
                  </Button>
                )}
              </div>

              {!loading && flatDocuments.length > 0 && (
                <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
                  <TabsList>
                    <TabsTrigger value="hierarchical" className="flex items-center space-x-2">
                      <TreePine className="h-4 w-4" />
                      <span>Categories</span>
                    </TabsTrigger>
                    <TabsTrigger value="grid" className="flex items-center space-x-2">
                      <Grid3X3 className="h-4 w-4" />
                      <span>All Documents</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>

            {/* Results Info */}
            {searchQuery && (
              <div className="flex items-center justify-between mb-6 p-4 bg-muted/30 rounded-lg border">
                <p className="text-muted-foreground">
                  {flatDocuments.length} {flatDocuments.length === 1 ? 'document' : 'documents'} matching "{searchQuery}"
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSearch('')}
                >
                  Clear Search
                </Button>
              </div>
            )}

            {/* Main Content */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {[...Array(10)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="h-5 bg-muted rounded w-3/4"></div>
                        <div className="h-4 bg-muted rounded w-full"></div>
                        <div className="h-4 bg-muted rounded w-1/2"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : flatDocuments.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="text-center py-12">
                  {searchQuery ? (
                    <>
                      <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No documents found</h3>
                      <p className="text-muted-foreground">
                        No documents match "{searchQuery}". Try different keywords or clear your search.
                      </p>
                    </>
                  ) : (
                    <>
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Documents will appear here once they are approved from the approval queue
                      </p>
                      <Button
                        onClick={() => window.location.href = '/dashboard/approval-queue'}
                        variant="outline"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Go to Approval Queue
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
                {/* Categories View */}
                <TabsContent value="hierarchical" className="mt-0">
                  <HierarchicalBrowser
                    data={hierarchicalData}
                    onDocumentSelect={handleDocumentSelect}
                    selectedDocumentId={selectedDocument?.id}
                    hasMetadataPanel={!!selectedDocument}
                  />
                </TabsContent>

                {/* All Documents View */}
                <TabsContent value="grid" className="mt-0">
                  <div className={`grid gap-4 ${selectedDocument
                    ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                    : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                    }`}>
                    {flatDocuments.map((document) => (
                      <Card
                        key={document.id}
                        className={`hover:shadow-lg transition-all duration-200 cursor-pointer group ${selectedDocument?.id === document.id
                          ? 'ring-2 ring-primary/20 bg-primary/5'
                          : 'hover:shadow-md'
                          }`}
                        onClick={() => handleDocumentSelect(document)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start space-x-4">
                            {/* Document Icon */}
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                            </div>

                            {/* Document Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors">
                                  {document.title}
                                </h3>
                                <div className="flex items-center space-x-2 text-xs text-muted-foreground ml-3">
                                  <span>v{document.version}</span>
                                </div>
                              </div>

                              {document.summary && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                  {document.summary}
                                </p>
                              )}

                              {/* Tags and Metadata Row */}
                              <div className="flex items-center justify-between">
                                {/* Tags */}
                                <div className="flex flex-wrap gap-1">
                                  {document.tags && document.tags.length > 0 ? (
                                    <>
                                      {document.tags.slice(0, 2).map((tag, index) => (
                                        <Badge key={index} variant="secondary" className="text-xs px-2 py-0">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {document.tags.length > 2 && (
                                        <Badge variant="outline" className="text-xs px-2 py-0">
                                          +{document.tags.length - 2}
                                        </Badge>
                                      )}
                                    </>
                                  ) : (
                                    <Badge variant="outline" className="text-xs px-2 py-0">
                                      No tags
                                    </Badge>
                                  )}
                                </div>

                                {/* Date */}
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(document.updated_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Right Sidebar - Metadata Panel */}
        {selectedDocument && (
          <div className="w-80 border-l bg-muted/20 flex-shrink-0">
            <div className="p-6 h-full overflow-y-auto">
              <div className="space-y-6">
                {/* Document Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                      {selectedDocument.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Selected Document Details
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDocument(null)}
                    className="ml-2 h-8 w-8 p-0"
                  >
                    ×
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setViewMode('document')}
                    className="flex-1"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button size="sm" variant="outline">
                    <Share className="h-4 w-4" />
                  </Button>
                </div>

                {/* Metadata Sections */}
                <div className="space-y-4">
                  {/* Document Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Document Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-medium">{selectedDocument.version}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Created</span>
                        <span>{formatDate(selectedDocument.created_at)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Updated</span>
                        <span>{formatDate(selectedDocument.updated_at)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Approved By</span>
                        <span>{selectedDocument.approved_by}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tags */}
                  {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Categories & Tags</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {selectedDocument.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Summary */}
                  {selectedDocument.summary && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {selectedDocument.summary}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Related Documents */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Related Documents</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Documents with similar tags or content will appear here
                      </p>
                    </CardContent>
                  </Card>

                  {/* Version History */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Version History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Version {selectedDocument.version}</span>
                          <span className="text-muted-foreground">Current</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          View complete version history and changes
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}