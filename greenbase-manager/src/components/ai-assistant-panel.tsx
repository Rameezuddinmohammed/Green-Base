"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Sparkles, 
  X, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  FileText,
  Users,
  Zap,
  ArrowRight,
  Brain,
  Target,
  Lightbulb
} from "lucide-react"

interface AIInsight {
  id: string
  type: 'suggestion' | 'warning' | 'opportunity' | 'trend'
  title: string
  description: string
  action?: string
  priority: 'high' | 'medium' | 'low'
  confidence: number
  data?: any
}

interface AIAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  stats: {
    pendingApprovals: number
    avgConfidenceScore: number
    activeSources: number
    totalDocuments: number
  }
}

export function AIAssistantPanel({ isOpen, onClose, stats }: AIAssistantPanelProps) {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      generateInsights()
    }
  }, [isOpen, stats])

  const generateInsights = async () => {
    setLoading(true)
    
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const generatedInsights: AIInsight[] = []

    // High priority insights
    if (stats.pendingApprovals > 5) {
      generatedInsights.push({
        id: '1',
        type: 'warning',
        title: 'High approval backlog detected',
        description: `${stats.pendingApprovals} documents are pending review. Consider batch approving high-confidence items.`,
        action: 'Review Queue',
        priority: 'high',
        confidence: 0.95
      })
    }

    if (stats.avgConfidenceScore < 0.7) {
      generatedInsights.push({
        id: '2',
        type: 'suggestion',
        title: 'Source quality optimization needed',
        description: 'Average confidence score is below optimal. Review source configurations and data quality.',
        action: 'Optimize Sources',
        priority: 'medium',
        confidence: 0.88
      })
    }

    // Opportunities
    if (stats.activeSources < 3) {
      generatedInsights.push({
        id: '3',
        type: 'opportunity',
        title: 'Expand knowledge sources',
        description: 'Connect additional data sources to improve coverage and insights.',
        action: 'Add Sources',
        priority: 'medium',
        confidence: 0.82
      })
    }

    // Trends
    generatedInsights.push({
      id: '4',
      type: 'trend',
      title: 'Documentation velocity increasing',
      description: 'AI processing speed has improved 23% this week. Knowledge base growth is accelerating.',
      priority: 'low',
      confidence: 0.91
    })

    // Smart suggestions
    generatedInsights.push({
      id: '5',
      type: 'suggestion',
      title: 'Automated approval opportunity',
      description: 'Documents with >85% confidence could be auto-approved to reduce manual review time.',
      action: 'Configure Rules',
      priority: 'medium',
      confidence: 0.87
    })

    setInsights(generatedInsights)
    setLoading(false)
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'suggestion': return <Lightbulb className="h-4 w-4 text-blue-500" />
      case 'opportunity': return <Target className="h-4 w-4 text-green-500" />
      case 'trend': return <TrendingUp className="h-4 w-4 text-purple-500" />
      default: return <Brain className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Panel */}
      <div className={`
        fixed top-0 right-0 h-full w-96 bg-background border-l shadow-2xl z-50 
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <p className="text-sm text-muted-foreground">Smart insights & recommendations</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4 animate-pulse" />
                  <span>Analyzing your knowledge base...</span>
                </div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-muted rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Quick Stats */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quick Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending Reviews</span>
                      <span className="font-medium">{stats.pendingApprovals}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Confidence</span>
                      <span className="font-medium">{Math.round(stats.avgConfidenceScore * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Active Sources</span>
                      <span className="font-medium">{stats.activeSources}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Insights */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">AI Insights</h3>
                  {insights.map((insight) => (
                    <Card key={insight.id} className="transition-all duration-200 hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {getInsightIcon(insight.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-sm font-medium text-foreground">
                                {insight.title}
                              </h4>
                              <Badge className={`text-xs ${getPriorityColor(insight.priority)}`}>
                                {insight.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              {insight.description}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(insight.confidence * 100)}% confident
                                </span>
                              </div>
                              {insight.action && (
                                <Button size="sm" variant="outline" className="h-7 text-xs">
                                  {insight.action}
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Zap className="h-4 w-4 mr-2" />
                      Sync All Sources
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Batch Approve High Confidence
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      View Team Analytics
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
              <Button variant="ghost" size="sm" onClick={generateInsights}>
                <Sparkles className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}