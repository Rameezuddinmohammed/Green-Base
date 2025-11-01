import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getDocumentParser } from '../../../../lib/ingestion/document-parser'
import { getIngestionService } from '../../../../lib/ingestion/ingestion-service'

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Manual upload API called')
    
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = await getSupabaseAdmin()
    
    // Get user's organization
    let { data: user } = await supabaseAdmin
      .from('users')
      .select('organization_id, role')
      .eq('id', session.user.id)
      .single()

    if (!user && session.user.email) {
      const { data: userByEmail } = await supabaseAdmin
        .from('users')
        .select('organization_id, role')
        .eq('email', session.user.email)
        .single()
      user = userByEmail
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`📄 Processing file: ${file.name} (${file.size} bytes, ${file.type})`)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse the document
    const documentParser = getDocumentParser()
    
    // Check if file type is supported
    if (!documentParser.isSupportedFileType(file.name, file.type)) {
      console.warn(`⚠️ Unsupported file type: ${file.name}`)
      // Still try to parse it, the parser will handle it gracefully
    }

    const parsedDoc = await documentParser.parseDocument(
      buffer, 
      file.name, 
      file.type,
      { maxLength: 50000 } // Limit content length
    )

    console.log(`✅ Document parsed successfully: ${parsedDoc.metadata.wordCount} words`)

    // Create source content for ingestion
    const sourceContent = [{
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'drive_file' as const,
      title: parsedDoc.metadata.title || file.name,
      content: parsedDoc.content,
      metadata: {
        author: parsedDoc.metadata.author || session.user.email || 'Unknown',
        createdAt: parsedDoc.metadata.createdAt || new Date(),
        sourceUrl: `manual-upload://${file.name}`,
        fileName: file.name,
        fileSize: file.size,
        fileType: parsedDoc.metadata.fileType,
        wordCount: parsedDoc.metadata.wordCount,
        pageCount: parsedDoc.metadata.pageCount,
        uploadedBy: session.user.email,
        uploadedAt: new Date()
      }
    }]

    // Process through ingestion service
    const ingestionService = getIngestionService()
    const result = await ingestionService.processSourceContent(
      sourceContent,
      'manual-upload',
      user.organization_id
    )

    console.log(`📊 Ingestion completed: ${result.documentsCreated} created, ${result.errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and processed successfully',
      result: {
        documentsCreated: result.documentsCreated,
        processingTime: result.processingTime,
        errors: result.errors
      },
      document: {
        title: parsedDoc.metadata.title,
        wordCount: parsedDoc.metadata.wordCount,
        fileType: parsedDoc.metadata.fileType,
        originalSize: file.size
      }
    })

  } catch (error: any) {
    console.error('❌ Manual upload error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process uploaded document', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}