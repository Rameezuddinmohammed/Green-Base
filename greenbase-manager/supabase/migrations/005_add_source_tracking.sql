-- Add source tracking fields to approved_documents table
ALTER TABLE approved_documents 
ADD COLUMN source_external_id TEXT,
ADD COLUMN source_type source_type,
ADD COLUMN source_url TEXT;

-- Add index for efficient lookups
CREATE INDEX idx_approved_documents_source_external_id ON approved_documents(source_external_id, organization_id);

-- Add source tracking to document_versions table as well
ALTER TABLE document_versions
ADD COLUMN source_external_id TEXT,
ADD COLUMN source_type source_type,
ADD COLUMN source_url TEXT;

-- Update existing approved documents to have source tracking from their draft origins
-- This will help with documents that were already approved
UPDATE approved_documents 
SET 
  source_external_id = COALESCE(
    (SELECT (source_references->0->>'sourceId')::text 
     FROM draft_documents 
     WHERE draft_documents.title = approved_documents.title 
     AND draft_documents.organization_id = approved_documents.organization_id 
     LIMIT 1),
    NULL
  ),
  source_type = COALESCE(
    (SELECT 
      CASE 
        WHEN (source_references->0->>'sourceType')::text = 'teams' THEN 'teams'::source_type
        WHEN (source_references->0->>'sourceType')::text = 'google_drive' THEN 'google_drive'::source_type
        ELSE NULL
      END
     FROM draft_documents 
     WHERE draft_documents.title = approved_documents.title 
     AND draft_documents.organization_id = approved_documents.organization_id 
     LIMIT 1),
    NULL
  ),
  source_url = COALESCE(
    (SELECT (source_references->0->>'sourceUrl')::text 
     FROM draft_documents 
     WHERE draft_documents.title = approved_documents.title 
     AND draft_documents.organization_id = approved_documents.organization_id 
     LIMIT 1),
    NULL
  )
WHERE source_external_id IS NULL;