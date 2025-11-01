"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileText,
  Calendar,
  User
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
  source_type?: 'teams' | 'google_drive'
  source_url?: string
  topics?: string[]
}

interface DocumentHierarchy {
  [key: string]: {
    documents: ApprovedDocument[]
    subfolders: DocumentHierarchy
  }
}

interface DocumentTreeProps {
  hierarchy: DocumentHierarchy
  onDocumentSelect: (document: ApprovedDocument) => void
  expandedFolders: Set<string>
  onToggleFolder: (folderPath: string) => void
}

export function DocumentTree({ 
  hierarchy, 
  onDocumentSelect, 
  expandedFolders, 
  onToggleFolder 
}: DocumentTreeProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const renderFolder = (
    folderName: string, 
    folderData: { documents: ApprovedDocument[], subfolders: DocumentHierarchy },
    level: number = 0,
    parentPath: string = ""
  ) => {
    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName
    const isExpanded = expandedFolders.has(folderPath)
    const hasContent = folderData.documents.length > 0 || Object.keys(folderData.subfolders).length > 0

    if (!hasContent) return null

    return (
      <div key={folderPath} className={`${level > 0 ? 'ml-4' : ''}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleFolder(folderPath)}
          className="w-full justify-start p-2 h-auto"
        >
          <div className="flex items-center space-x-2">
            {hasContent && (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            )}
            {isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
            <span className="font-medium">{folderName}</span>
            <Badge variant="secondary" className="text-xs">
              {folderData.documents.length}
            </Badge>
          </div>
        </Button>

        {isExpanded && (
          <div className="ml-6 mt-2 space-y-1">
            {/* Render documents in this folder */}
            {folderData.documents.map((doc) => (
              <Button
                key={doc.id}
                variant="ghost"
                size="sm"
                onClick={() => onDocumentSelect(doc)}
                className="w-full justify-start p-2 h-auto text-left"
              >
                <div className="flex items-start space-x-2 w-full">
                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center space-x-2">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(doc.updated_at)}
                      </span>
                      <span className="flex items-center">
                        <User className="h-3 w-3 mr-1" />
                        v{doc.version}
                      </span>
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {doc.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                            {tag}
                          </Badge>
                        ))}
                        {doc.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            +{doc.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            ))}

            {/* Render subfolders */}
            {Object.entries(folderData.subfolders).map(([subfolderName, subfolderData]) =>
              renderFolder(subfolderName, subfolderData, level + 1, folderPath)
            )}
          </div>
        )}
      </div>
    )
  }

  if (Object.keys(hierarchy).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Folder className="h-12 w-12 mx-auto mb-4" />
        <p>No documents organized yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {Object.entries(hierarchy).map(([folderName, folderData]) =>
        renderFolder(folderName, folderData)
      )}
    </div>
  )
}