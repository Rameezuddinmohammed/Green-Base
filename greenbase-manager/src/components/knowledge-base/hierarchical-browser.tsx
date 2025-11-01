"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileText,
  Calendar,
  User,
  Tag
} from "lucide-react"

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

interface HierarchicalBrowserProps {
  data: Category[]
  onDocumentSelect: (document: KBDocument) => void
  selectedDocumentId?: string
  hasMetadataPanel?: boolean
}

export function HierarchicalBrowser({ 
  data, 
  onDocumentSelect, 
  selectedDocumentId,
  hasMetadataPanel = false
}: HierarchicalBrowserProps) {
  // Initialize all categories as expanded by default
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(data.map(category => category.id))
  )

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  // Update expanded categories when data changes
  React.useEffect(() => {
    setExpandedCategories(new Set(data.map(category => category.id)))
  }, [data])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (data.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="text-center py-12">
          <Folder className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
          <p className="text-muted-foreground">
            Documents will be automatically organized by topic and content type
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((category) => {
        const isExpanded = expandedCategories.has(category.id)
        const hasDocuments = category.children && category.children.length > 0

        return (
          <div key={category.id} className="border border-border rounded-lg">
            {/* Compact Category Header */}
            <div className="flex items-center justify-between p-3 bg-muted/30">
              <Button
                variant="ghost"
                onClick={() => toggleCategory(category.id)}
                className="flex items-center space-x-2 p-0 h-auto hover:bg-transparent"
              >
                {hasDocuments && (
                  isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                )}
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{category.name}</span>
              </Button>
              <Badge variant="secondary" className="text-xs px-2 py-1">
                {category.children?.length || 0}
              </Badge>
            </div>

            {/* Documents List - Always visible when expanded */}
            {isExpanded && hasDocuments && (
              <div className="p-3 pt-0">
                <div className="space-y-2">
                  {category.children.map((document) => (
                    <div
                      key={document.id}
                      className={`p-3 rounded-md border transition-all duration-200 cursor-pointer hover:shadow-sm group ${
                        selectedDocumentId === document.id 
                          ? 'bg-primary/5 border-primary/30 shadow-sm' 
                          : 'bg-background hover:bg-muted/30 border-border hover:border-primary/20'
                      }`}
                      onClick={() => onDocumentSelect(document)}
                    >
                      <div className="flex items-start space-x-3">
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                                {document.title}
                              </h4>
                              
                              {document.summary && (
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                                  {document.summary}
                                </p>
                              )}
                            </div>
                            
                            {/* Metadata on the right */}
                            <div className="flex items-center space-x-3 text-xs text-muted-foreground ml-4">
                              <span>{formatDate(document.updated_at)}</span>
                              <span>v{document.version}</span>
                            </div>
                          </div>

                          {/* Tags below title */}
                          {document.tags && document.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {document.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs px-2 py-0">
                                  {tag}
                                </Badge>
                              ))}
                              {document.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs px-2 py-0">
                                  +{document.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}