import { NextRequest, NextResponse } from 'next/server'
import { getPIIRedactionService } from '@/lib/ai/pii-redaction'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text) {
      return NextResponse.json({ 
        success: false, 
        error: 'Text is required for testing' 
      }, { status: 400 })
    }

    console.log('🧪 Testing Azure AI Language service...')
    console.log('Input text length:', text.length)
    
    const piiService = getPIIRedactionService()
    
    // Test PII redaction
    const startTime = Date.now()
    const result = await piiService.redactPII(text)
    const processingTime = Date.now() - startTime
    
    console.log('✅ Azure AI Language test completed successfully')
    console.log('Processing time:', processingTime, 'ms')
    console.log('Entities found:', result.entities.length)
    
    return NextResponse.json({
      success: true,
      message: 'Azure AI Language service is working correctly',
      result: {
        originalLength: result.originalLength,
        redactedLength: result.redactedLength,
        entitiesFound: result.entities.length,
        processingTime,
        entities: result.entities.map(entity => ({
          category: entity.category,
          subcategory: entity.subcategory,
          confidenceScore: entity.confidenceScore,
          textLength: entity.length
        })),
        // Show first 200 chars of redacted text for verification
        redactedPreview: result.redactedText.substring(0, 200) + (result.redactedText.length > 200 ? '...' : '')
      }
    })
    
  } catch (error: any) {
    console.error('❌ Azure AI Language test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Azure AI Language test failed',
      details: {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack trace
      }
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Test with sample text containing PII
  const sampleText = `
    Hi John Smith, 
    
    Please contact me at john.smith@company.com or call me at (555) 123-4567.
    
    My address is 123 Main Street, Anytown, NY 12345.
    
    Best regards,
    Jane Doe
    jane.doe@example.org
    Phone: +1-555-987-6543
  `
  
  try {
    console.log('🧪 Running Azure AI Language test with sample data...')
    
    const piiService = getPIIRedactionService()
    const result = await piiService.redactPII(sampleText.trim())
    
    return NextResponse.json({
      success: true,
      message: 'Azure AI Language service test completed',
      testData: {
        originalText: sampleText.trim(),
        redactedText: result.redactedText,
        entitiesFound: result.entities.length,
        entities: result.entities.map(entity => ({
          text: entity.text,
          category: entity.category,
          subcategory: entity.subcategory,
          confidenceScore: entity.confidenceScore
        }))
      }
    })
    
  } catch (error: any) {
    console.error('❌ Azure AI Language test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Test failed',
      details: {
        name: error.name,
        message: error.message
      }
    }, { status: 500 })
  }
}