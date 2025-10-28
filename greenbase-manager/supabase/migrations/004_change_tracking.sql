-- Migration: Add change tracking capabilities for automatic syncing
-- This enables automatic detection of changes in connected sources

-- Add change tracking fields to connected_sources table
ALTER TABLE connected_sources 
ADD COLUMN change_token TEXT, -- For Google Drive: startPageToken, For Teams: delta token
ADD COLUMN last_change_check TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN sync_frequency_minutes INTEGER DEFAULT 15, -- How often to check for changes
ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT true;

-- Create source_sync_history table to track sync operations
CREATE TABLE source_sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES connected_sources(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('manual', 'automatic', 'webhook')),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    error_message TEXT,
    change_token_before TEXT,
    change_token_after TEXT,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create source_items table to track individual items and their change status
CREATE TABLE source_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES connected_sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL, -- ID from Google Drive or Teams
    item_type TEXT NOT NULL CHECK (item_type IN ('file', 'message', 'folder')),
    name TEXT NOT NULL,
    last_modified TIMESTAMPTZ NOT NULL,
    etag TEXT, -- For change detection
    parent_id TEXT, -- For hierarchical items
    is_processed BOOLEAN DEFAULT false,
    last_processed_at TIMESTAMPTZ,
    draft_document_id UUID REFERENCES draft_documents(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure uniqueness per source
    UNIQUE(source_id, external_id)
);

-- Create indexes for performance
CREATE INDEX idx_connected_sources_auto_sync ON connected_sources(auto_sync_enabled, last_change_check) WHERE auto_sync_enabled = true;
CREATE INDEX idx_source_sync_history_source_id ON source_sync_history(source_id);
CREATE INDEX idx_source_sync_history_status ON source_sync_history(status);
CREATE INDEX idx_source_items_source_id ON source_items(source_id);
CREATE INDEX idx_source_items_external_id ON source_items(external_id);
CREATE INDEX idx_source_items_last_modified ON source_items(last_modified);
CREATE INDEX idx_source_items_is_processed ON source_items(is_processed);
CREATE INDEX idx_source_items_organization_id ON source_items(organization_id);

-- Add update trigger for source_items
CREATE TRIGGER update_source_items_updated_at 
    BEFORE UPDATE ON source_items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to get sources that need syncing
CREATE OR REPLACE FUNCTION get_sources_needing_sync()
RETURNS TABLE (
    source_id UUID,
    user_id UUID,
    type source_type,
    name TEXT,
    last_change_check TIMESTAMPTZ,
    sync_frequency_minutes INTEGER,
    change_token TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cs.id,
        cs.user_id,
        cs.type,
        cs.name,
        cs.last_change_check,
        cs.sync_frequency_minutes,
        cs.change_token
    FROM connected_sources cs
    WHERE cs.auto_sync_enabled = true
      AND cs.is_active = true
      AND (
          cs.last_change_check IS NULL 
          OR cs.last_change_check < NOW() - INTERVAL '1 minute' * cs.sync_frequency_minutes
      );
END;
$$ LANGUAGE plpgsql;

-- Create function to update source change token
CREATE OR REPLACE FUNCTION update_source_change_token(
    p_source_id UUID,
    p_change_token TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE connected_sources 
    SET 
        change_token = p_change_token,
        last_change_check = NOW()
    WHERE id = p_source_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to record sync operation
CREATE OR REPLACE FUNCTION record_sync_operation(
    p_source_id UUID,
    p_sync_type TEXT,
    p_status TEXT,
    p_items_processed INTEGER DEFAULT 0,
    p_items_created INTEGER DEFAULT 0,
    p_items_updated INTEGER DEFAULT 0,
    p_error_message TEXT DEFAULT NULL,
    p_change_token_before TEXT DEFAULT NULL,
    p_change_token_after TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    sync_id UUID;
    org_id UUID;
BEGIN
    -- Get organization_id from source
    SELECT u.organization_id INTO org_id
    FROM connected_sources cs
    JOIN users u ON cs.user_id = u.id
    WHERE cs.id = p_source_id;
    
    INSERT INTO source_sync_history (
        source_id,
        sync_type,
        started_at,
        completed_at,
        status,
        items_processed,
        items_created,
        items_updated,
        error_message,
        change_token_before,
        change_token_after,
        organization_id
    ) VALUES (
        p_source_id,
        p_sync_type,
        NOW(),
        CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END,
        p_status,
        p_items_processed,
        p_items_created,
        p_items_updated,
        p_error_message,
        p_change_token_before,
        p_change_token_after,
        org_id
    ) RETURNING id INTO sync_id;
    
    RETURN sync_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE source_sync_history IS 'Tracks all sync operations for audit and monitoring';
COMMENT ON TABLE source_items IS 'Tracks individual items from sources for change detection';
COMMENT ON FUNCTION get_sources_needing_sync() IS 'Returns sources that need to be synced based on their frequency settings';
COMMENT ON FUNCTION update_source_change_token(UUID, TEXT) IS 'Updates the change token for a source after successful sync';
COMMENT ON FUNCTION record_sync_operation(UUID, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT) IS 'Records a sync operation in the history table';