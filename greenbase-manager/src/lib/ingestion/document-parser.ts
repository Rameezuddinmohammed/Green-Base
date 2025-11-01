import * as pdfParse from 'pdf-parse'
import * as mammoth from 'mammoth'

export interface ParsedDocument {
  content: string
  metadata: {
    title?: string
    author?: string
    createdAt?: Date
    pageCount?: number
    wordCount?: number
    fileType: string
    originalSize: number
  }
}

export interface ParseOptions {
  maxLength?: number
  preserveFormatting?: boolean
}

class DocumentParser {
  /**
   * Parse document content based on file type
   */
  async parseDocument(
    buffer: Buffer, 
    fileName: string, 
    mimeType?: string,
    options: ParseOptions = {}
  ): Promise<ParsedDocument> {
    const fileExtension = this.getFileExtension(fileName)
    const detectedMimeType = mimeType || this.getMimeTypeFromExtension(fileExtension)
    
    console.log(`📄 Parsing document: ${fileName} (${fileExtension}, ${detectedMimeType})`)
    
    try {
      switch (fileExtension.toLowerCase()) {
        case 'pdf':
          return await this.parsePDF(buffer, fileName, options)
        case 'docx':
        case 'doc':
          return await this.parseWord(buffer, fileName, options)
        case 'txt':
          return await this.parseText(buffer, fileName, options)
        case 'md':
          return await this.parseMarkdown(buffer, fileName, options)
        default:
          // Try to parse as text for unknown types
          console.warn(`⚠️ Unknown file type: ${fileExtension}, attempting text parsing`)
          return await this.parseText(buffer, fileName, options)
      }
    } catch (error) {
      console.error(`❌ Failed to parse ${fileName}:`, error)
      
      // Fallback: try to extract any readable text
      return this.createFallbackDocument(buffer, fileName, error as Error)
    }
  }

  /**
   * Parse PDF documents
   */
  private async parsePDF(buffer: Buffer, fileName: string, options: ParseOptions): Promise<ParsedDocument> {
    console.log('📖 Parsing PDF document...')
    
    const pdfData = await pdfParse(buffer)
    
    let content = pdfData.text
    
    // Clean up common PDF parsing artifacts
    content = this.cleanPDFText(content)
    
    // Apply length limit if specified
    if (options.maxLength && content.length > options.maxLength) {
      content = content.substring(0, options.maxLength) + '\n\n[Content truncated...]'
    }
    
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    
    return {
      content,
      metadata: {
        title: this.extractTitleFromContent(content) || fileName.replace(/\.[^/.]+$/, ''),
        pageCount: pdfData.numpages,
        wordCount,
        fileType: 'pdf',
        originalSize: buffer.length,
        author: pdfData.info?.Author,
        createdAt: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined
      }
    }
  }

  /**
   * Parse Word documents (.docx, .doc)
   */
  private async parseWord(buffer: Buffer, fileName: string, options: ParseOptions): Promise<ParsedDocument> {
    console.log('📝 Parsing Word document...')
    
    const result = await mammoth.extractRawText({ buffer })
    let content = result.value
    
    // Apply length limit if specified
    if (options.maxLength && content.length > options.maxLength) {
      content = content.substring(0, options.maxLength) + '\n\n[Content truncated...]'
    }
    
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    
    return {
      content,
      metadata: {
        title: this.extractTitleFromContent(content) || fileName.replace(/\.[^/.]+$/, ''),
        wordCount,
        fileType: 'docx',
        originalSize: buffer.length
      }
    }
  }

  /**
   * Parse plain text files
   */
  private async parseText(buffer: Buffer, fileName: string, options: ParseOptions): Promise<ParsedDocument> {
    console.log('📄 Parsing text document...')
    
    let content = buffer.toString('utf-8')
    
    // Try different encodings if UTF-8 fails
    if (this.containsGarbledText(content)) {
      console.log('🔄 UTF-8 parsing failed, trying other encodings...')
      
      // Try common encodings
      const encodings = ['latin1', 'ascii', 'utf16le']
      for (const encoding of encodings) {
        try {
          const testContent = buffer.toString(encoding as BufferEncoding)
          if (!this.containsGarbledText(testContent)) {
            content = testContent
            console.log(`✅ Successfully parsed with ${encoding} encoding`)
            break
          }
        } catch (error) {
          continue
        }
      }
    }
    
    // Apply length limit if specified
    if (options.maxLength && content.length > options.maxLength) {
      content = content.substring(0, options.maxLength) + '\n\n[Content truncated...]'
    }
    
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    
    return {
      content,
      metadata: {
        title: this.extractTitleFromContent(content) || fileName.replace(/\.[^/.]+$/, ''),
        wordCount,
        fileType: 'text',
        originalSize: buffer.length
      }
    }
  }

  /**
   * Parse Markdown files
   */
  private async parseMarkdown(buffer: Buffer, fileName: string, options: ParseOptions): Promise<ParsedDocument> {
    console.log('📝 Parsing Markdown document...')
    
    let content = buffer.toString('utf-8')
    
    // Apply length limit if specified
    if (options.maxLength && content.length > options.maxLength) {
      content = content.substring(0, options.maxLength) + '\n\n[Content truncated...]'
    }
    
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length
    
    return {
      content,
      metadata: {
        title: this.extractTitleFromMarkdown(content) || fileName.replace(/\.[^/.]+$/, ''),
        wordCount,
        fileType: 'markdown',
        originalSize: buffer.length
      }
    }
  }

  /**
   * Create fallback document when parsing fails
   */
  private createFallbackDocument(buffer: Buffer, fileName: string, error: Error): ParsedDocument {
    console.log('🚨 Creating fallback document due to parsing failure')
    
    // Try to extract any readable text
    let content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000))
    
    // If content is mostly binary/garbled, create a descriptive message
    if (this.containsGarbledText(content) || content.length < 10) {
      content = `# ${fileName}\n\n**File Type:** ${this.getFileExtension(fileName).toUpperCase()}\n**Size:** ${this.formatFileSize(buffer.length)}\n\n**Note:** This file could not be parsed automatically. The content may be in a binary format or use an unsupported encoding.\n\n**Error:** ${error.message}\n\nTo process this document, please:\n1. Convert it to a supported format (PDF, DOCX, TXT, MD)\n2. Or manually extract the text content\n3. Re-upload the converted file`
    }
    
    return {
      content,
      metadata: {
        title: fileName.replace(/\.[^/.]+$/, ''),
        fileType: 'unknown',
        originalSize: buffer.length,
        wordCount: content.split(/\s+/).filter(word => word.length > 0).length
      }
    }
  }

  /**
   * Clean up common PDF text extraction artifacts
   */
  private cleanPDFText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s{3,}/g, '\n\n')
      // Fix broken words across lines
      .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
      // Clean up page breaks
      .replace(/\n{4,}/g, '\n\n\n')
      // Remove common PDF artifacts
      .replace(/^\s*\d+\s*$/gm, '') // Remove standalone page numbers
      .trim()
  }

  /**
   * Check if text contains garbled/binary content
   */
  private containsGarbledText(text: string): boolean {
    // Check for high ratio of non-printable characters
    const nonPrintable = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g)
    const nonPrintableRatio = nonPrintable ? nonPrintable.length / text.length : 0
    
    // Check for PDF-like binary markers
    const hasPDFMarkers = text.includes('%PDF') || text.includes('endobj') || text.includes('stream')
    
    return nonPrintableRatio > 0.1 || hasPDFMarkers
  }

  /**
   * Extract title from document content
   */
  private extractTitleFromContent(content: string): string | null {
    // Look for markdown-style headers
    const headerMatch = content.match(/^#\s+(.+)$/m)
    if (headerMatch) {
      return headerMatch[1].trim()
    }
    
    // Look for the first non-empty line as potential title
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    if (lines.length > 0 && lines[0].length < 100) {
      return lines[0]
    }
    
    return null
  }

  /**
   * Extract title from Markdown content
   */
  private extractTitleFromMarkdown(content: string): string | null {
    // Look for H1 headers
    const h1Match = content.match(/^#\s+(.+)$/m)
    if (h1Match) {
      return h1Match[1].trim()
    }
    
    // Look for title in frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      const titleMatch = frontmatterMatch[1].match(/^title:\s*(.+)$/m)
      if (titleMatch) {
        return titleMatch[1].trim().replace(/['"]/g, '')
      }
    }
    
    return null
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.substring(lastDot + 1) : ''
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'txt': 'text/plain',
      'md': 'text/markdown'
    }
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Validate if a file type is supported
   */
  isSupportedFileType(fileName: string, mimeType?: string): boolean {
    const extension = this.getFileExtension(fileName).toLowerCase()
    const supportedExtensions = ['pdf', 'docx', 'doc', 'txt', 'md']
    
    return supportedExtensions.includes(extension)
  }

  /**
   * Get supported file types list
   */
  getSupportedFileTypes(): string[] {
    return ['pdf', 'docx', 'doc', 'txt', 'md']
  }
}

// Singleton instance
let documentParser: DocumentParser | null = null

export function getDocumentParser(): DocumentParser {
  if (!documentParser) {
    documentParser = new DocumentParser()
  }
  return documentParser
}

export { DocumentParser }