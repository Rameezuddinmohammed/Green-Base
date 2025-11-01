"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Sparkles, 
  FileText,
  Calendar,
  User,
  Loader2,
  AlertCircle
} from "lucide-react"

interface SearchResult {
  id: string
  title: string
  content: string
  summary: string
  tags: string[]
  created_at: string
  updated_at: string
  approved_by: string
  version: number
  snippet?: string
  similarity?: number
  approver?: {
    email: string
  }
}

interface SimpleAISearchProps {
  onResults: (results: SearchResult[], searchMethod: string) => void
  onDocumentSelect: (document: SearchResult) => void
}

export function SimpleAISearch({ onResults, onDocumentSelect }: SimpleAISearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchMethod, setSearchMethod] = useState<string>('')
  const [error, setError] = useState<string>('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) return

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`/api/knowledge-base/search?q=${encodeURIComponent(query.trim())}`)
      
      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      const searchResults = data.documents || []
      const method = data.searchType || 'text'
      
      setResults(searchResults)
      setSearchMethod(method)
      onResults(searchResults, method)
      
    } catch (error) {
      console.error('Search error:', error)
      setError('Search failed. Please try again.')
      setResults([])
      onResults([], '')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const highlightText = (text: string, query: string) => {
    if (!query) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>AI-Powered Search</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search your knowledge base using natural language or specific terms
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search for documents, topics, or ask a question..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Search Results</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant={searchMethod === 'semantic' ? 'default' : 'secondary'}>
                  {searchMethod === 'semantic' ? (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Search
                    </>
                  ) : (
                    'Text Search'
                  )}
                </Badge>
                <Badge variant="outline">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => onDocumentSelect(result)}
                >
                  <div className="flex items-start space-x-3">
                    <FileText className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium mb-1 line-clamp-2">
                        {highlightText(result.title, query)}
                      </h4>
                      
                      {result.snippet && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-3">
                          {highlightText(result.snippet, query)}
                        </p>
                      )}

                      {/* Tags */}
                      {result.tags && result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {result.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {result.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{result.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(result.updated_at)}
                          </span>
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            v{result.version}
                          </span>
                        </div>
                        
                        {result.similarity && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(result.similarity * 100)}% match
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!loading && query && results.length === 0 && !error && (
        <Card>
          <CardContent className="text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try different keywords or check your spelling
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search Tips */}
      {!query && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div>
                <strong>Natural Language:</strong> Ask questions like "How do I configure authentication?" or "What are the deployment steps?"
              </div>
              <div>
                <strong>Keywords:</strong> Search for specific terms like "API", "database", "security"
              </div>
              <div>
                <strong>Topics:</strong> Find documents by topic like "user management", "data processing"
              </div>
              <div>
                <strong>AI Search:</strong> Our AI understands context and finds semantically similar content
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}