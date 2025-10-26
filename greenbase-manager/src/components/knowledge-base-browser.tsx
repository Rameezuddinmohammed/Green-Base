"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  BookOpen, 
  FileText, 
  Calendar, 
  Tag, 
  Archive,
  Eye,
  Edit,
  Trash2,
  Download,
  Share,
  Star,
  Clock,
  User
} from "lucide-react"

interface KnowledgeDocument {
  id: string
  title: string
  content: string
  summary?: string
  topics?: string[]
  source_type: 'teams' | 'google_drive'
  source_name: string
  created_at: string
  updated_at: string
  status: 'active' | 'archived'
  confidence_score?: number
  author?: string
  file_type?: string
  size?: number
  views?: number
  is_favorite?: boolean
}

interface KnowledgeBaseBrowserProps {
  showActions?: boolean
  compact?: boolean
}

export function KnowledgeBaseBrowser({ showActions = true, compact = false }: KnowledgeBaseBrowserProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'relevance' | 'views'>('date')
  const [filterBy, setFilterBy] = useState<'all' | 'teams' | 'google_drive' | 'favorites'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'table'>('list')
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])

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

  const handleToggleFavorite = async (documentId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/${documentId}/favorite`, {
        method: 'POST'
      })
      
      if (response.ok) {
        await loadDocuments()
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'teams': return '💬'
      case 'google_drive': return '📁'
      default: return '📄'
    }
  }

  const getFileTypeIcon = (fileType?: string) => {
    if (!fileType) return '📄'
    if (fileType.includes('pdf')) return '📕'
    if (fileType.includes('word') || fileType.includes('doc')) return '📘'
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📗'
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📙'
    return '📄'
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  const filteredAndSortedDocuments = documents
    .filter(doc => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = doc.title.toLowerCase().includes(query)
        const matchesContent = doc.content.toLowerCase().includes(query)
        const matchesTopics = doc.topics?.some(topic => topic.toLowerCase().includes(query))
        if (!matchesTitle && !matchesContent && !matchesTopics) return false
      }
      
      // Source filter
      if (filterBy === 'teams' && doc.source_type !== 'teams') return false
      if (filterBy === 'google_drive' && doc.source_type !== 'google_drive') return false
      if (filterBy === 'favorites' && !doc.is_favorite) return false
      
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'title':
          return a.title.localeCompare(b.title)
        case 'views':
          return (b.views || 0) - (a.views || 0)
        case 'relevance':
          // Simple relevance based on search query match
          if (!searchQuery) return 0
          const aRelevance = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ? 2 : 1
          const bRelevance = b.title.toLowerCase().includes(searchQuery.toLowerCase()) ? 2 : 1
          return bRelevance - aRelevance
        default:
          return 0
      }
    })

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Knowledge Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Knowledge Base
              <Badge className="ml-2 bg-blue-100 text-blue-800">
                {filteredAndSortedDocuments.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Search and browse your organization's knowledge
            </CardDescription>
          </div>
          
          {showActions && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents, topics, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="teams">Teams</SelectItem>
                <SelectItem value="google_drive">Google Drive</SelectItem>
                <SelectItem value="favorites">Favorites</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="views">Views</SelectItem>
                <SelectItem value="relevance">Relevance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        {filteredAndSortedDocuments.length === 0 ? (
          <div className="text-center py-12">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search terms or filters
                </p>
              </>
            ) : (
              <>
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No documents yet</h3>
                <p className="text-muted-foreground">
                  Connect sources to start building your knowledge base
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedDocuments.map((doc) => (
              <Card key={doc.id} className="hover-lift">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    {/* Document Icon */}
                    <div className="flex-shrink-0 text-2xl">
                      {getFileTypeIcon(doc.file_type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-foreground truncate">
                              {doc.title}
                            </h3>
                            {doc.is_favorite && (
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            )}
                          </div>
                          
                          {/* Metadata */}
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-3">
                            <div className="flex items-center">
                              <span className="mr-1">{getSourceIcon(doc.source_type)}</span>
                              {doc.source_name}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {new Date(doc.updated_at).toLocaleDateString()}
                            </div>
                            {doc.author && (
                              <div className="flex items-center">
                                <User className="h-4 w-4 mr-1" />
                                {doc.author}
                              </div>
                            )}
                            {doc.views && (
                              <div className="flex items-center">
                                <Eye className="h-4 w-4 mr-1" />
                                {doc.views} views
                              </div>
                            )}
                            {doc.size && (
                              <span>{formatFileSize(doc.size)}</span>
                            )}
                          </div>

                          {/* Summary */}
                          {doc.summary && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                              {doc.summary}
                            </p>
                          )}

                          {/* Topics */}
                          {doc.topics && doc.topics.length > 0 && (
                            <div className="flex items-center space-x-2 mb-3">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                              <div className="flex flex-wrap gap-1">
                                {doc.topics.slice(0, 4).map((topic, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {topic}
                                  </Badge>
                                ))}
                                {doc.topics.length > 4 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{doc.topics.length - 4} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Confidence Score */}
                        {doc.confidence_score && (
                          <div className="flex-shrink-0 ml-4">
                            <Badge 
                              className={
                                doc.confidence_score >= 0.8 
                                  ? 'bg-green-100 text-green-800' 
                                  : doc.confidence_score >= 0.5 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {Math.round(doc.confidence_score * 100)}% confidence
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {showActions && (
                        <div className="flex items-center space-x-2 mt-4">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleToggleFavorite(doc.id)}
                          >
                            <Star className={`h-4 w-4 mr-1 ${doc.is_favorite ? 'fill-current text-yellow-500' : ''}`} />
                            {doc.is_favorite ? 'Unfavorite' : 'Favorite'}
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleArchiveDocument(doc.id)}
                            className="text-orange-600 hover:text-orange-700"
                          >
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}