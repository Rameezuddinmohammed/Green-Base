"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export default function UploadTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/manual', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setResult(data)
      console.log('Upload result:', data)
    } catch (err: any) {
      setError(err.message)
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Document Upload Test</h1>
          <p className="text-muted-foreground">Test the document parsing and ingestion pipeline</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Supported formats: PDF, DOCX, DOC, TXT, MD
              </p>
            </div>

            {file && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Selected File:</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {file.name}</p>
                  <p><strong>Size:</strong> {formatFileSize(file.size)}</p>
                  <p><strong>Type:</strong> {file.type || 'Unknown'}</p>
                </div>
              </div>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? 'Processing...' : 'Upload & Process'}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="text-red-600">
                <h4 className="font-medium mb-2">Error:</h4>
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800">Upload Successful!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Badge variant="secondary">Documents Created</Badge>
                  <p className="text-2xl font-bold">{result.result.documentsCreated}</p>
                </div>
                <div>
                  <Badge variant="secondary">Processing Time</Badge>
                  <p className="text-2xl font-bold">{result.result.processingTime}ms</p>
                </div>
              </div>

              {result.document && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Document Info:</h4>
                  <div className="space-y-1 text-sm">
                    <p><strong>Title:</strong> {result.document.title}</p>
                    <p><strong>Word Count:</strong> {result.document.wordCount}</p>
                    <p><strong>File Type:</strong> {result.document.fileType}</p>
                    <p><strong>Original Size:</strong> {formatFileSize(result.document.originalSize)}</p>
                  </div>
                </div>
              )}

              {result.result.errors.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium mb-2 text-yellow-800">Warnings:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {result.result.errors.map((error: string, index: number) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                The document has been processed and added to the approval queue. 
                Check the <a href="/dashboard/approvals" className="text-blue-600 hover:underline">Approval Queue</a> to review and approve it.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}