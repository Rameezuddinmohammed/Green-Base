"use client"

import { useMemo } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content || content.trim() === '') {
      return '<p class="text-muted-foreground">No content available</p>'
    }

    // Helper function for inline formatting
    const processInlineFormatting = (text: string): string => {
      return text
        // Bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
        // Inline code
        .replace(/`(.*?)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline underline-offset-2" target="_blank" rel="noopener noreferrer">$1</a>')
    }

    // Process content line by line to preserve structure
    const lines = content.split('\n')
    const processedLines: string[] = []
    let inOrderedList = false
    let inUnorderedList = false
    let listItems: string[] = []

    const flushList = () => {
      if (listItems.length > 0) {
        if (inOrderedList) {
          processedLines.push(`<ol class="list-decimal ml-6 mb-2 space-y-0.5">${listItems.join('')}</ol>`)
        } else if (inUnorderedList) {
          processedLines.push(`<ul class="ml-4 mb-2 space-y-0.5">${listItems.join('')}</ul>`)
        }
        listItems = []
        inOrderedList = false
        inUnorderedList = false
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Empty line - minimal spacing for business documents
      if (!line) {
        flushList()
        // Only add minimal spacing between sections
        if (processedLines.length > 0 && !processedLines[processedLines.length - 1].includes('<div class="h-2">')) {
          processedLines.push('<div class="h-2"></div>')
        }
        continue
      }

      // Headers - compact spacing for business documents
      if (line.startsWith('### ')) {
        flushList()
        processedLines.push(`<h3 class="text-lg font-semibold mt-3 mb-1">${line.substring(4)}</h3>`)
        continue
      }
      if (line.startsWith('## ')) {
        flushList()
        processedLines.push(`<h2 class="text-xl font-semibold mt-4 mb-1.5">${line.substring(3)}</h2>`)
        continue
      }
      if (line.startsWith('# ')) {
        flushList()
        processedLines.push(`<h1 class="text-2xl font-bold mt-4 mb-2">${line.substring(2)}</h1>`)
        continue
      }

      // Numbered lists
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/)
      if (numberedMatch) {
        if (!inOrderedList) {
          flushList()
          inOrderedList = true
        }
        const text = numberedMatch[2]
        listItems.push(`<li class="mb-0.5">${processInlineFormatting(text)}</li>`)
        continue
      }

      // Bullet lists
      const bulletMatch = line.match(/^[\*\-]\s+(.*)$/)
      if (bulletMatch) {
        if (!inUnorderedList) {
          flushList()
          inUnorderedList = true
        }
        const text = bulletMatch[1]
        listItems.push(`<li class="mb-0.5">${processInlineFormatting(text)}</li>`)
        continue
      }

      // Regular paragraph
      flushList()
      if (line) {
        processedLines.push(`<p class="mb-1.5">${processInlineFormatting(line)}</p>`)
      }
    }

    // Flush any remaining list
    flushList()

    return processedLines.join('')
  }, [content])

  return (
    <div
      className={`max-w-none leading-snug ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}