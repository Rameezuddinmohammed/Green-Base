"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Search, 
  BookOpen, 
  Calendar, 
  User, 
  Tag, 
  Archive, 
  RotateCcw,
  ExternalLink,
  Eye,
  Edit,
  Trash2,
  Filter,
  ArrowUpDown
} from "lucide-react"

interface ApprovedDocument {
  id: string
  title: string
  content: string
  summary: string
  tags: string[]
  created_at: string
  updated_at: string
  approved_by: string
  version: number
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<ApprovedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'relevance'>('date')
  const [viewingDocument, setViewingDocument] = useState<ApprovedDocument | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/knowledge-base')
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadDocuments()
      return
    }

    try {
      const response = await fetch(`/api/knowledge-base/search?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const handleArchiveDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/${documentId}/archive`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadDocuments()
      }
    } catch (error) {
      console.error('Failed to archive document:', error)
    }
  }

  // Get all unique tags
  const allTags = Array.from(
    new Set(documents.flatMap(doc => doc.tags || []))
  ).sort()

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      const matchesSearch = !searchQuery || 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.summary.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesTag = selectedTag === 'all' || doc.tags?.includes(selectedTag)
      
      return matchesSearch && matchesTag
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'date':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'relevance':
          // Simple relevance based on search query matches
          if (!searchQuery) return 0
          const aMatches = (a.title.toLowerCase().match(new RegExp(searchQuery.toLowerCase(), 'g')) || []).length
          const bMatches = (b.title.toLowerCase().match(new RegExp(searchQuery.toLowerCase(), 'g')) || []).length
          return bMatches - aMatches
        default:
          return 0
      }
    })

  const formatDate = (dateString: string) => {
    if (typeof window === 'undefined') return 'Loading...'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <DashboardLayout>
      <div className="container py-8 px-4">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
              <p className="text-muted-foreground">
                Search and browse your approved documentation
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {documents.length} documents
              </Badge>
            </div>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10"
                  />
                </div>
                
                {/* Tag Filter */}
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="relevance">Relevance</SelectItem>
                  </SelectContent>
                </Select>

                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documents Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="h-6 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? 'No documents found' : 'No documents yet'}
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery 
                    ? 'Try adjusting your search terms or filters'
                    : 'Documents will appear here once they are approved from the approval queue'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((document) => (
                <Card key={document.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2">
                          {document.title}
                        </CardTitle>
                        <CardDescription className="mt-2 line-clamp-3">
                          {document.summary}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      {/* Tags */}
                      {document.tags && document.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {document.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {document.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{document.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          {formatDate(document.updated_at)}
                        </div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          Version {document.version}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingDocument(document)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleArchiveDocument(document.id)}
                        >
                          <Archive className="h-4 w-4 mr-1" />
                          Archive
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewingDocument?.title}</DialogTitle>
            <DialogDescription>
              Version {viewingDocument?.version} • Last updated {viewingDocument && formatDate(viewingDocument.updated_at)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-96 overflow-y-auto">
            {viewingDocument?.summary && (
              <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">{viewingDocument.summary}</p>
              </div>
            )}
            
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {viewingDocument?.content}
              </pre>
            </div>
          </div>
          
          {viewingDocument?.tags && viewingDocument.tags.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {viewingDocument.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}