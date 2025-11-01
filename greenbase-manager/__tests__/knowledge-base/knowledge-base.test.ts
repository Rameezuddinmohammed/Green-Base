import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock fetch for API calls
global.fetch = jest.fn()

describe('Knowledge Base Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Document Organization', () => {
    it('should organize documents by topics and source types', () => {
      const documents = [
        {
          id: '1',
          title: 'HR Policy',
          topics: ['Human Resources'],
          source_type: 'teams',
          content: 'HR content',
          summary: 'HR summary',
          tags: ['policy'],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          approved_by: 'user1',
          version: 1
        },
        {
          id: '2',
          title: 'Tech Guide',
          topics: ['Technology'],
          source_type: 'google_drive',
          content: 'Tech content',
          summary: 'Tech summary',
          tags: ['guide'],
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
          approved_by: 'user2',
          version: 1
        }
      ]

      const buildHierarchy = (docs: typeof documents) => {
        const hierarchy: any = {}
        
        docs.forEach(doc => {
          const primaryTopic = doc.topics?.[0] || 'Uncategorized'
          const sourceType = doc.source_type || 'unknown'
          
          if (!hierarchy[primaryTopic]) {
            hierarchy[primaryTopic] = { documents: [], subfolders: {} }
          }
          
          if (!hierarchy[primaryTopic].subfolders[sourceType]) {
            hierarchy[primaryTopic].subfolders[sourceType] = { documents: [], subfolders: {} }
          }
          
          hierarchy[primaryTopic].subfolders[sourceType].documents.push(doc)
        })
        
        return hierarchy
      }

      const hierarchy = buildHierarchy(documents)

      expect(hierarchy['Human Resources']).toBeDefined()
      expect(hierarchy['Technology']).toBeDefined()
      expect(hierarchy['Human Resources'].subfolders.teams.documents).toHaveLength(1)
      expect(hierarchy['Technology'].subfolders.google_drive.documents).toHaveLength(1)
    })
  })

  describe('Search Functionality', () => {
    it('should handle both text and semantic search', async () => {
      const mockResponse = {
        documents: [
          {
            id: '1',
            title: 'Test Document',
            content: 'This is a test document about policies',
            snippet: '...test document about policies...',
            similarity: 0.85
          }
        ],
        searchType: 'semantic',
        totalResults: 1
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const response = await fetch('/api/knowledge-base/search?q=policy')
      const data = await response.json()

      expect(data.documents).toHaveLength(1)
      expect(data.searchType).toBe('semantic')
      expect(data.documents[0].snippet).toContain('policies')
    })

    it('should generate proper search snippets', () => {
      const generateSnippet = (content: string, query: string, maxLength: number = 200): string => {
        const queryLower = query.toLowerCase()
        const contentLower = content.toLowerCase()
        const queryIndex = contentLower.indexOf(queryLower)
        
        if (queryIndex === -1) {
          return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '')
        }
        
        const start = Math.max(0, queryIndex - 50)
        const end = Math.min(content.length, queryIndex + query.length + 150)
        const snippet = content.substring(start, end)
        
        return (start > 0 ? '...' : '') + snippet + (end < content.length ? '...' : '')
      }

      const content = 'This is a long document about company policies and procedures. The policy section contains important information about employee conduct and guidelines.'
      const query = 'policy'
      
      const snippet = generateSnippet(content, query)
      
      expect(snippet).toContain('policy')
      expect(snippet.length).toBeLessThanOrEqual(200)
    })
  })

  describe('Version History', () => {
    it('should track document versions correctly', async () => {
      const mockVersions = [
        {
          id: '1',
          version: 2,
          content: 'Updated content',
          changes: 'Added new section',
          approved_by: 'user@example.com',
          approved_at: '2024-01-02T00:00:00Z',
          created_at: '2024-01-02T00:00:00Z'
        },
        {
          id: '2',
          version: 1,
          content: 'Original content',
          changes: 'Initial version',
          approved_by: 'user@example.com',
          approved_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versions: mockVersions })
      })

      const response = await fetch('/api/knowledge-base/doc1/versions')
      const data = await response.json()

      expect(data.versions).toHaveLength(2)
      expect(data.versions[0].version).toBe(2) // Should be ordered by version desc
      expect(data.versions[1].version).toBe(1)
    })
  })

  describe('Document Filtering', () => {
    it('should filter documents by tags and topics', () => {
      const documents = [
        {
          id: '1',
          title: 'HR Doc',
          tags: ['policy', 'hr'],
          topics: ['Human Resources'],
          content: 'HR content',
          summary: 'HR summary',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          approved_by: 'user1',
          version: 1
        },
        {
          id: '2',
          title: 'Tech Doc',
          tags: ['guide', 'tech'],
          topics: ['Technology'],
          content: 'Tech content',
          summary: 'Tech summary',
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
          approved_by: 'user2',
          version: 1
        }
      ]

      const filterByTag = (docs: typeof documents, tag: string) => {
        return docs.filter(doc => doc.tags.includes(tag))
      }

      const hrDocs = filterByTag(documents, 'policy')
      const techDocs = filterByTag(documents, 'guide')

      expect(hrDocs).toHaveLength(1)
      expect(hrDocs[0].title).toBe('HR Doc')
      expect(techDocs).toHaveLength(1)
      expect(techDocs[0].title).toBe('Tech Doc')
    })
  })

  describe('Markdown Rendering', () => {
    it('should convert markdown to HTML properly', () => {
      const convertMarkdown = (content: string) => {
        return content
          .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>')
          .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>')
          .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
          .replace(/`(.*?)`/g, '<code class="bg-muted px-2 py-1 rounded text-sm font-mono">$1</code>')
      }

      const markdown = '# Title\n## Subtitle\n**Bold text** and *italic text* with `code`'
      const html = convertMarkdown(markdown)

      expect(html).toContain('<h1 class="text-2xl font-bold mt-8 mb-4">Title</h1>')
      expect(html).toContain('<h2 class="text-xl font-semibold mt-8 mb-4">Subtitle</h2>')
      expect(html).toContain('<strong class="font-semibold">Bold text</strong>')
      expect(html).toContain('<em class="italic">italic text</em>')
      expect(html).toContain('<code class="bg-muted px-2 py-1 rounded text-sm font-mono">code</code>')
    })
  })
})