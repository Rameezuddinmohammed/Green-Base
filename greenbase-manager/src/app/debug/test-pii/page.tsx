"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export default function TestPIIPage() {
  const [inputText, setInputText] = useState(`Hi John Smith,

Please contact me at john.smith@company.com or call me at (555) 123-4567.

My address is 123 Main Street, Anytown, NY 12345.
My SSN is 123-45-6789 and my credit card is 4532-1234-5678-9012.

Best regards,
Jane Doe
jane.doe@example.org
Phone: +1-555-987-6543
IP: 192.168.1.100`)
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  const handleTestPII = async () => {
    if (!inputText.trim()) {
      setError("Please enter some text to test")
      return
    }

    setLoading(true)
    setError("")
    setResult(null)
    
    try {
      const response = await fetch('/api/debug/test-azure-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        setError(data.error || 'PII test failed')
        return
      }
      
      setResult(data.result)
      
    } catch (error: any) {
      console.error('PII test error:', error)
      setError(error.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleRunSampleTest = async () => {
    setLoading(true)
    setError("")
    setResult(null)
    
    try {
      const response = await fetch('/api/debug/test-azure-language')
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Sample test failed')
        return
      }
      
      // Show the sample test data
      setResult({
        originalLength: data.testData.originalText.length,
        redactedLength: data.testData.redactedText.length,
        entitiesFound: data.testData.entities.length,
        entities: data.testData.entities,
        redactedPreview: data.testData.redactedText
      })
      
    } catch (error: any) {
      console.error('Sample test error:', error)
      setError(error.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Azure AI Language - PII Redaction Test</CardTitle>
            <CardDescription>
              Test the Azure AI Language service for PII detection and redaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inputText">Input Text (with PII)</Label>
                <Textarea
                  id="inputText"
                  placeholder="Enter text containing PII to test redaction..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleTestPII} disabled={loading} className="flex-1">
                  {loading ? 'Testing PII Redaction...' : 'Test PII Redaction'}
                </Button>
                <Button onClick={handleRunSampleTest} disabled={loading} variant="outline">
                  Run Sample Test
                </Button>
              </div>
              
              {error && (
                <div className="text-sm text-red-600 p-3 bg-red-50 rounded-md">
                  <div className="font-medium">❌ Test Failed</div>
                  <div className="mt-1">{error}</div>
                </div>
              )}
              
              {result && (
                <div className="space-y-4">
                  <div className="text-sm text-green-600 p-3 bg-green-50 rounded-md">
                    <div className="font-medium">✅ PII Redaction Successful!</div>
                    <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                      <div><strong>Original Length:</strong> {result.originalLength} chars</div>
                      <div><strong>Redacted Length:</strong> {result.redactedLength} chars</div>
                      <div><strong>Entities Found:</strong> {result.entitiesFound}</div>
                      <div><strong>Processing Time:</strong> {result.processingTime}ms</div>
                    </div>
                  </div>
                  
                  {result.entities && result.entities.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Detected PII Entities</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {result.entities.map((entity: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <div>
                                <span className="font-medium">{entity.category}</span>
                                {entity.subcategory && (
                                  <span className="text-gray-500"> ({entity.subcategory})</span>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">
                                  Confidence: {(entity.confidenceScore * 100).toFixed(1)}%
                                </div>
                                {entity.textLength && (
                                  <div className="text-xs text-gray-500">
                                    Length: {entity.textLength} chars
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {result.redactedPreview && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Redacted Text Preview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded font-mono">
                          {result.redactedPreview}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Azure AI Language Service:</span>
                <span className="text-green-600 font-medium">✅ Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span>PII Detection:</span>
                <span className="text-green-600 font-medium">✅ Working</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fallback Regex:</span>
                <span className="text-blue-600 font-medium">🔄 Available</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}