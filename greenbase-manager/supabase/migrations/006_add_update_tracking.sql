-- Add update tracking fields to draft_documents table
ALTER TABLE draft_documents 
ADD COLUMN is_update BOOLEAN DEFAULT FALSE,
ADD COLUMN original_document_id UUID REFERENCES approved_documents(id),
ADD COLUMN changes_made TEXT[] DEFAULT '{}';

-- Add index for efficient lookups of updates
CREATE INDEX idx_draft_documents_is_update ON draft_documents(is_update, original_document_id);

-- Add a function to generate change summaries using AI
CREATE OR REPLACE FUNCTION generate_change_summary(old_content TEXT, new_content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simple change detection for now - can be enhanced with AI later
  IF old_content = new_content THEN
    RETURN 'No changes detected';
  ELSE
    RETURN 'Content has been updated';
  END IF;
END;
$$;