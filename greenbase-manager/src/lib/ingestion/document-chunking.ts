export interface DocumentChunk {
  content: string
  metadata: {
    chunkIndex: number
    startOffset: number
    endOffset: number
    tokenCount: number
  }
}

export interface ChunkingOptions {
  maxTokens?: number
  overlapTokens?: number
  preserveSentences?: boolean
  preserveParagraphs?: boolean
}

export class DocumentChunking {
  private static readonly DEFAULT_MAX_TOKENS = 500
  private static readonly DEFAULT_OVERLAP_TOKENS = 50
  private static readonly APPROX_TOKENS_PER_CHAR = 0.25 // Rough estimate

  /**
   * Split a document into chunks suitable for embedding
   */
  static chunkDocument(
    content: string,
    options: ChunkingOptions = {}
  ): DocumentChunk[] {
    const {
      maxTokens = this.DEFAULT_MAX_TOKENS,
      overlapTokens = this.DEFAULT_OVERLAP_TOKENS,
      preserveSentences = true,
      preserveParagraphs = false
    } = options

    if (!content || content.trim().length === 0) {
      return [{
        content: content || '',
        metadata: {
          chunkIndex: 0,
          startOffset: 0,
          endOffset: content?.length || 0,
          tokenCount: 0
        }
      }]
    }

    const maxChars = Math.floor(maxTokens / this.APPROX_TOKENS_PER_CHAR)
    const overlapChars = Math.floor(overlapTokens / this.APPROX_TOKENS_PER_CHAR)

    // If content is short enough, return as single chunk
    if (content.length <= maxChars) {
      return [{
        content,
        metadata: {
          chunkIndex: 0,
          startOffset: 0,
          endOffset: content.length,
          tokenCount: this.estimateTokenCount(content)
        }
      }]
    }

    const chunks: DocumentChunk[] = []
    let currentOffset = 0
    let chunkIndex = 0

    while (currentOffset < content.length) {
      const endOffset = Math.min(currentOffset + maxChars, content.length)
      let chunkContent = content.substring(currentOffset, endOffset)

      // Try to preserve sentence boundaries
      if (preserveSentences && endOffset < content.length) {
        const lastSentenceEnd = this.findLastSentenceEnd(chunkContent)
        if (lastSentenceEnd > chunkContent.length * 0.5) {
          chunkContent = chunkContent.substring(0, lastSentenceEnd)
        }
      }

      // Try to preserve paragraph boundaries
      if (preserveParagraphs && endOffset < content.length) {
        const lastParagraphEnd = this.findLastParagraphEnd(chunkContent)
        if (lastParagraphEnd > chunkContent.length * 0.3) {
          chunkContent = chunkContent.substring(0, lastParagraphEnd)
        }
      }

      chunks.push({
        content: chunkContent.trim(),
        metadata: {
          chunkIndex,
          startOffset: currentOffset,
          endOffset: currentOffset + chunkContent.length,
          tokenCount: this.estimateTokenCount(chunkContent)
        }
      })

      // Calculate next offset with overlap
      const nextOffset = currentOffset + chunkContent.length - overlapChars
      currentOffset = Math.max(nextOffset, currentOffset + 1) // Ensure progress
      chunkIndex++
    }

    return chunks
  }

  /**
   * Chunk text by sentences
   */
  static chunkBySentences(
    content: string,
    maxSentences: number = 5,
    overlapSentences: number = 1
  ): DocumentChunk[] {
    const sentences = this.splitIntoSentences(content)
    
    if (sentences.length <= maxSentences) {
      return [{
        content,
        metadata: {
          chunkIndex: 0,
          startOffset: 0,
          endOffset: content.length,
          tokenCount: this.estimateTokenCount(content)
        }
      }]
    }

    const chunks: DocumentChunk[] = []
    let chunkIndex = 0

    for (let i = 0; i < sentences.length; i += maxSentences - overlapSentences) {
      const chunkSentences = sentences.slice(i, i + maxSentences)
      const chunkContent = chunkSentences.join(' ')
      
      const startOffset = content.indexOf(chunkSentences[0])
      const endOffset = startOffset + chunkContent.length

      chunks.push({
        content: chunkContent.trim(),
        metadata: {
          chunkIndex,
          startOffset,
          endOffset,
          tokenCount: this.estimateTokenCount(chunkContent)
        }
      })

      chunkIndex++
    }

    return chunks
  }

  /**
   * Chunk text by paragraphs
   */
  static chunkByParagraphs(
    content: string,
    maxParagraphs: number = 3,
    overlapParagraphs: number = 1
  ): DocumentChunk[] {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim())
    
    if (paragraphs.length <= maxParagraphs) {
      return [{
        content,
        metadata: {
          chunkIndex: 0,
          startOffset: 0,
          endOffset: content.length,
          tokenCount: this.estimateTokenCount(content)
        }
      }]
    }

    const chunks: DocumentChunk[] = []
    let chunkIndex = 0

    for (let i = 0; i < paragraphs.length; i += maxParagraphs - overlapParagraphs) {
      const chunkParagraphs = paragraphs.slice(i, i + maxParagraphs)
      const chunkContent = chunkParagraphs.join('\n\n')
      
      const startOffset = content.indexOf(chunkParagraphs[0])
      const endOffset = startOffset + chunkContent.length

      chunks.push({
        content: chunkContent.trim(),
        metadata: {
          chunkIndex,
          startOffset,
          endOffset,
          tokenCount: this.estimateTokenCount(chunkContent)
        }
      })

      chunkIndex++
    }

    return chunks
  }

  private static findLastSentenceEnd(text: string): number {
    const sentenceEnders = /[.!?]+/g
    let lastMatch = -1
    let match

    while ((match = sentenceEnders.exec(text)) !== null) {
      lastMatch = match.index + match[0].length
    }

    return lastMatch > 0 ? lastMatch : text.length
  }

  private static findLastParagraphEnd(text: string): number {
    const lastNewline = text.lastIndexOf('\n\n')
    return lastNewline > 0 ? lastNewline + 2 : text.length
  }

  private static splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be improved with more sophisticated NLP
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.')
  }

  private static estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length * this.APPROX_TOKENS_PER_CHAR)
  }

  /**
   * Merge small chunks that are below minimum size
   */
  static mergeSmallChunks(
    chunks: DocumentChunk[],
    minTokens: number = 50
  ): DocumentChunk[] {
    const mergedChunks: DocumentChunk[] = []
    let currentChunk: DocumentChunk | null = null

    for (const chunk of chunks) {
      if (!currentChunk) {
        currentChunk = { ...chunk }
        continue
      }

      if (currentChunk.metadata.tokenCount < minTokens) {
        // Merge with current chunk
        currentChunk.content += '\n\n' + chunk.content
        currentChunk.metadata.endOffset = chunk.metadata.endOffset
        currentChunk.metadata.tokenCount += chunk.metadata.tokenCount
      } else {
        // Current chunk is large enough, add it and start new one
        mergedChunks.push(currentChunk)
        currentChunk = { ...chunk }
      }
    }

    if (currentChunk) {
      mergedChunks.push(currentChunk)
    }

    // Re-index chunks
    return mergedChunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index
      }
    }))
  }
}