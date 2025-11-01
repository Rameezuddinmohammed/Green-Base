"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "../ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { 
  Sparkles, 
  Brain, 
  FolderTree, 
  BarChart3, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Eye,
  Settings,
  TrendingUp,
  FileText,
  Tag,
  Clock
} from "lucide-react"

interface CategorySuggestion {
  name: string
  description: string
  confidence: number
  documentIds: string[]
  keywords: string[]
  reasoning: string
}

interface CategorizationStats {
  totalDocuments: number
  categorizedDocuments: number
  uncategorizedDocuments: number
  categories: string[]
}

interface CategorizationResult {
  categories: CategorySuggestion[]
  uncategorized: string[]
  stats: {
    totalDocuments: number
    categorizedDocuments: number
    uncategorizedDocuments: number
    categoriesCreated: number
    processingTime: number
    tokensUsed: number
  }
  applied: boolean
}

interface SmartCategorizationProps {
  onCategorizeComplete?: () => void
}

export function SmartCategorization({ onCategorizeComplete }: SmartCategorizationProps) {
  const [stats, setStats] = useState<CategorizationStats | null>(null)
  const [result, setResult] = useState<CategorizationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategorySuggestion | null>(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await fetch('/api/knowledge-base/categorize')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load categorization stats:', error)
    }
  }

  const runCategorization = async (mode: 'full' | 'selective' = 'full') => {
    setLoading(true)
    try {
      const response = await fetch('/api/knowledge-base/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, apply: false })
      })

      if (response.ok) {
        const data = await response.json()
        setResult(data)
        setShowPreview(true)
      } else {
        const error = await response.json()
        console.error('Categorization failed:', error)
      }
    } catch (error) {
      console.error('Categorization error:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyCategorization = async () => {
    if (!result) return

    setApplying(true)
    try {
      const response = await fetch('/api/knowledge-base/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: 'full', 
          apply: true,
          categories: result.categories
        })
      })

      if (response.ok) {
        setResult({ ...result, applied: true })
        await loadStats()
        onCategorizeComplete?.()
      }
    } catch (error) {
      console.error('Failed to apply categorization:', error)
    } finally {
      setApplying(false)
    }
  }

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const categorizationProgress = stats ? (stats.categorizedDocuments / stats.totalDocuments) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2 text-primary" />
            Smart Document Categorization
          </CardTitle>
          <CardDescription>
            AI-powered document organization that analyzes content to create intelligent categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{stats.totalDocuments}</div>
                  <div className="text-sm text-muted-foreground">Total Documents</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.categorizedDocuments}</div>
                  <div className="text-sm text-muted-foreground">Categorized</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.uncategorizedDocuments}</div>
                  <div className="text-sm text-muted-foreground">Uncategorized</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.categories.length}</div>
                  <div className="text-sm text-muted-foreground">Categories</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Organization Progress</span>
                  <span>{Math.round(categorizationProgress)}%</span>
                </div>
                <Progress value={categorizationProgress} className="h-2" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => runCategorization('full')}
                    disabled={loading}
                    className="flex items-center"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {loading ? 'Analyzing...' : 'Run AI Categorization'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={loadStats}
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {stats.uncategorizedDocuments > 0 && (
                  <Badge variant="outline" className="text-orange-600">
                    {stats.uncategorizedDocuments} documents need categorization
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Categories */}
      {stats && stats.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderTree className="h-5 w-5 mr-2" />
              Current Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.categories.map((category, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {category}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categorization Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              AI Categorization Results
            </DialogTitle>
            <DialogDescription>
              Review the AI-suggested categories before applying them to your documents
            </DialogDescription>
          </DialogHeader>

          {result && (
            <Tabs defaultValue="categories" className="flex-1">
              <TabsList>
                <TabsTrigger value="categories">Categories ({result.categories.length})</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
                <TabsTrigger value="uncategorized">Uncategorized ({result.uncategorized.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="categories" className="mt-4">
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-4">
                    {result.categories.map((category, index) => (
                      <Card key={index} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{category.name}</CardTitle>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                variant="outline" 
                                className={getConfidenceColor(category.confidence)}
                              >
                                {formatConfidence(category.confidence)} confidence
                              </Badge>
                              <Badge variant="secondary">
                                {category.documentIds.length} docs
                              </Badge>
                            </div>
                          </div>
                          <CardDescription>{category.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            <div>
                              <div className="text-sm font-medium mb-1">Keywords:</div>
                              <div className="flex flex-wrap gap-1">
                                {category.keywords.map((keyword, kidx) => (
                                  <Badge key={kidx} variant="outline" className="text-xs">
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-sm font-medium mb-1">AI Reasoning:</div>
                              <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                                {category.reasoning}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedCategory(category)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Documents ({category.documentIds.length})
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="stats" className="mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="text-2xl font-bold">{result.stats.totalDocuments}</div>
                          <div className="text-sm text-muted-foreground">Documents Analyzed</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Tag className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="text-2xl font-bold">{result.stats.categoriesCreated}</div>
                          <div className="text-sm text-muted-foreground">Categories Created</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-5 w-5 text-purple-600" />
                        <div>
                          <div className="text-2xl font-bold">{Math.round(result.stats.processingTime / 1000)}s</div>
                          <div className="text-sm text-muted-foreground">Processing Time</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Zap className="h-5 w-5 text-orange-600" />
                        <div>
                          <div className="text-2xl font-bold">{result.stats.tokensUsed.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">AI Tokens Used</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg">Categorization Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Documents Categorized:</span>
                        <span className="font-medium">{result.stats.categorizedDocuments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Documents Uncategorized:</span>
                        <span className="font-medium">{result.stats.uncategorizedDocuments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Success Rate:</span>
                        <span className="font-medium text-green-600">
                          {Math.round((result.stats.categorizedDocuments / result.stats.totalDocuments) * 100)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="uncategorized" className="mt-4">
                {result.uncategorized.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-orange-600">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        Uncategorized Documents
                      </CardTitle>
                      <CardDescription>
                        These documents couldn't be automatically categorized and may need manual review
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        {result.uncategorized.length} documents require manual categorization
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                      <h3 className="text-lg font-medium mb-2">Perfect Categorization!</h3>
                      <p className="text-muted-foreground">
                        All documents were successfully categorized by AI
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {result && !result.applied && 'Preview mode - changes not yet applied'}
              {result && result.applied && 'Categories have been applied successfully'}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Close
              </Button>
              {result && !result.applied && (
                <Button 
                  onClick={applyCategorization}
                  disabled={applying}
                  className="flex items-center"
                >
                  {applying ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {applying ? 'Applying...' : 'Apply Categories'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Details Dialog */}
      <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCategory?.name}</DialogTitle>
            <DialogDescription>{selectedCategory?.description}</DialogDescription>
          </DialogHeader>
          
          {selectedCategory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">Confidence Score</div>
                  <div className={`text-lg font-bold ${getConfidenceColor(selectedCategory.confidence)}`}>
                    {formatConfidence(selectedCategory.confidence)}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">Documents</div>
                  <div className="text-lg font-bold">{selectedCategory.documentIds.length}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Keywords</div>
                <div className="flex flex-wrap gap-1">
                  {selectedCategory.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">AI Reasoning</div>
                <div className="text-sm bg-muted/50 p-3 rounded">
                  {selectedCategory.reasoning}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}