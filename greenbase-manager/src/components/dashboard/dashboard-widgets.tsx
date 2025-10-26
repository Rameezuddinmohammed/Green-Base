"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Users,
  Zap,
  BarChart3,
  Settings,
  Eye,
  EyeOff,
  Grid3X3,
  List,
  RefreshCw,
  Download,
  Filter
} from "lucide-react"

interface WidgetConfig {
  id: string
  title: string
  enabled: boolean
  order: number
}

interface DashboardWidgetsProps {
  stats: {
    totalDocuments: number
    pendingApprovals: number
    activeSources: number
    avgConfidenceScore: number
    recentActivity: Array<{
      id: string
      type: 'approval' | 'sync' | 'creation'
      title: string
      timestamp: Date
      confidence?: number
    }>
  }
  loading?: boolean
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'quick-stats', title: 'Quick Stats', enabled: true, order: 1 },
  { id: 'recent-activity', title: 'Recent Activity', enabled: true, order: 2 },
  { id: 'ai-insights', title: 'AI Insights', enabled: true, order: 3 },
  { id: 'source-status', title: 'Source Status', enabled: false, order: 4 },
  { id: 'approvals-preview', title: 'Approvals Preview', enabled: true, order: 5 }
]

export function DashboardWidgets({ stats, loading = false }: DashboardWidgetsProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showConfig, setShowConfig] = useState(false)

  const toggleWidget = (widgetId: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    ))
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'approval': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'sync': return <Zap className="h-4 w-4 text-blue-500" />
      case 'creation': return <FileText className="h-4 w-4 text-purple-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <span className="badge badge-green">High</span>
    if (score >= 0.5) return <span className="badge badge-yellow">Medium</span>
    return <span className="badge badge-red">Low</span>
  }

  const enabledWidgets = widgets.filter(w => w.enabled).sort((a, b) => a.order - b.order)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-48"></div>
          <div className="skeleton h-10 w-32"></div>
        </div>
        <div className={viewMode === 'grid' ? 'auto-grid' : 'space-y-4'}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Widget Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
        
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2 bg-muted rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Widget Configuration */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Customize
          </Button>

          {/* Refresh */}
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Widget Configuration Panel */}
      {showConfig && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Customize Dashboard</CardTitle>
            <CardDescription>
              Toggle widgets on/off to personalize your dashboard view
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {widgets.map((widget) => (
                <div key={widget.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{widget.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {widget.enabled ? 'Visible' : 'Hidden'}
                    </p>
                  </div>
                  <Switch
                    checked={widget.enabled}
                    onCheckedChange={() => toggleWidget(widget.id)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widgets Grid/List */}
      <div className={viewMode === 'grid' ? 'auto-grid' : 'space-y-6'}>
        {enabledWidgets.map((widget) => {
          switch (widget.id) {
            case 'quick-stats':
              return (
                <div key={widget.id} className={viewMode === 'list' ? 'col-span-full' : ''}>
                  <Card className="card-elevated">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <BarChart3 className="h-5 w-5 mr-2" />
                        Quick Stats
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-foreground">{stats.totalDocuments}</div>
                          <div className="text-sm text-muted-foreground">Total Documents</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">{stats.pendingApprovals}</div>
                          <div className="text-sm text-muted-foreground">Pending Approvals</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{stats.activeSources}</div>
                          <div className="text-sm text-muted-foreground">Active Sources</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{Math.round(stats.avgConfidenceScore * 100)}%</div>
                          <div className="text-sm text-muted-foreground">Avg Confidence</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )

            case 'recent-activity':
              return (
                <Card key={widget.id} className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription>Latest updates across your knowledge base</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.recentActivity.length > 0 ? (
                        stats.recentActivity.slice(0, 5).map((activity) => (
                          <div key={activity.id} className="flex items-center space-x-3">
                            {getActivityIcon(activity.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {activity.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {activity.timestamp.toLocaleString()}
                              </p>
                            </div>
                            {activity.confidence && (
                              <div className="flex-shrink-0">
                                {getConfidenceBadge(activity.confidence)}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No recent activity</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )

            case 'ai-insights':
              return (
                <Card key={widget.id} className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Zap className="h-5 w-5 mr-2 text-primary" />
                      AI Insights
                    </CardTitle>
                    <CardDescription>Smart recommendations for your knowledge base</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {stats.pendingApprovals > 0 && (
                        <div className="notification notification-warning">
                          <div className="flex items-start space-x-3">
                            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {stats.pendingApprovals} documents need review
                              </p>
                              <p className="text-xs mt-1">
                                High confidence items can be batch approved
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {stats.avgConfidenceScore < 0.7 && (
                        <div className="notification notification-info">
                          <div className="flex items-start space-x-3">
                            <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                Consider source quality review
                              </p>
                              <p className="text-xs mt-1">
                                Average confidence is below optimal threshold
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {stats.activeSources === 0 && (
                        <div className="notification notification-info">
                          <div className="flex items-start space-x-3">
                            <Settings className="h-5 w-5 text-purple-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                Connect your first source
                              </p>
                              <p className="text-xs mt-1">
                                Start by connecting Teams or Google Drive
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {stats.pendingApprovals === 0 && stats.activeSources > 0 && (
                        <div className="notification notification-success">
                          <div className="flex items-start space-x-3">
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                All caught up!
                              </p>
                              <p className="text-xs mt-1">
                                No pending approvals. Your knowledge base is up to date.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )

            case 'approvals-preview':
              return (
                <Card key={widget.id} className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-2" />
                        Approvals Preview
                        {stats.pendingApprovals > 0 && (
                          <Badge className="ml-2 bg-orange-100 text-orange-800">
                            {stats.pendingApprovals}
                          </Badge>
                        )}
                      </div>
                      <Button variant="outline" size="sm">
                        View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.pendingApprovals > 0 ? (
                      <div className="space-y-3">
                        {stats.recentActivity
                          .filter(a => a.type === 'creation')
                          .slice(0, 3)
                          .map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.timestamp.toLocaleString()}
                                </p>
                              </div>
                              {item.confidence && (
                                <div className="flex items-center space-x-2">
                                  {getConfidenceBadge(item.confidence)}
                                  <Button size="sm" className="btn-success">
                                    Approve
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No pending approvals</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )

            default:
              return null
          }
        })}
      </div>
    </div>
  )
}