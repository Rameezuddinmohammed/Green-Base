import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing parallel processing configuration...')
    
    // Test environment variables
    const parallelEnabled = process.env.ENABLE_PARALLEL_PROCESSING === 'true'
    const maxConcurrency = parseInt(process.env.MAX_PROCESSING_CONCURRENCY || '3')
    
    console.log(`📊 Parallel Processing Config:`)
    console.log(`  - Enabled: ${parallelEnabled}`)
    console.log(`  - Max Concurrency: ${maxConcurrency}`)
    
    // Simulate processing time test
    const testDocuments = [
      { title: 'Test Doc 1', content: 'Content 1' },
      { title: 'Test Doc 2', content: 'Content 2' },
      { title: 'Test Doc 3', content: 'Content 3' },
      { title: 'Test Doc 4', content: 'Content 4' },
      { title: 'Test Doc 5', content: 'Content 5' }
    ]
    
    // Sequential timing test
    console.log('⏱️ Testing sequential processing timing...')
    const sequentialStart = Date.now()
    for (const doc of testDocuments) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate 1s processing
    }
    const sequentialTime = Date.now() - sequentialStart
    
    // Parallel timing test
    console.log('⏱️ Testing parallel processing timing...')
    const parallelStart = Date.now()
    const batches = []
    for (let i = 0; i < testDocuments.length; i += maxConcurrency) {
      batches.push(testDocuments.slice(i, i + maxConcurrency))
    }
    
    for (const batch of batches) {
      await Promise.all(
        batch.map(() => new Promise(resolve => setTimeout(resolve, 1000)))
      )
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    const parallelTime = Date.now() - parallelStart
    
    const speedup = ((sequentialTime - parallelTime) / sequentialTime * 100).toFixed(1)
    
    return NextResponse.json({
      success: true,
      config: {
        parallelEnabled,
        maxConcurrency,
        testDocuments: testDocuments.length
      },
      performance: {
        sequentialTime: `${(sequentialTime / 1000).toFixed(1)}s`,
        parallelTime: `${(parallelTime / 1000).toFixed(1)}s`,
        speedupPercentage: `${speedup}%`,
        estimatedBatches: batches.length
      },
      recommendation: parallelEnabled 
        ? `✅ Parallel processing enabled with ${maxConcurrency} max concurrency`
        : `⚠️ Parallel processing disabled - set ENABLE_PARALLEL_PROCESSING=true to enable`
    })
    
  } catch (error) {
    console.error('❌ Parallel processing test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}