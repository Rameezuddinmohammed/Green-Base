-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE approved_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_interactions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's organization ID
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id 
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is a manager
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'manager'
        FROM users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
-- Users can only see their own organization
CREATE POLICY "Users can view their own organization" ON organizations
    FOR SELECT USING (id = get_user_organization_id());

-- Only managers can update their organization
CREATE POLICY "Managers can update their organization" ON organizations
    FOR UPDATE USING (id = get_user_organization_id() AND is_manager());

-- Users policies
-- Users can view users in their organization
CREATE POLICY "Users can view users in their organization" ON users
    FOR SELECT USING (organization_id = get_user_organization_id());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Managers can update users in their organization
CREATE POLICY "Managers can update users in their organization" ON users
    FOR UPDATE USING (organization_id = get_user_organization_id() AND is_manager());

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (id = auth.uid());

-- Connected sources policies
-- Users can manage their own connected sources
CREATE POLICY "Users can manage their own connected sources" ON connected_sources
    FOR ALL USING (user_id = auth.uid());

-- Draft documents policies
-- Users can view draft documents in their organization
CREATE POLICY "Users can view draft documents in their organization" ON draft_documents
    FOR SELECT USING (organization_id = get_user_organization_id());

-- Only managers can update draft documents (approve/reject)
CREATE POLICY "Managers can update draft documents" ON draft_documents
    FOR UPDATE USING (organization_id = get_user_organization_id() AND is_manager());

-- System can insert draft documents (for ingestion service)
CREATE POLICY "System can insert draft documents" ON draft_documents
    FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- Source documents policies
-- Users can view source documents for drafts in their organization
CREATE POLICY "Users can view source documents in their organization" ON source_documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM draft_documents 
            WHERE id = source_documents.draft_document_id 
            AND organization_id = get_user_organization_id()
        )
    );

-- System can insert source documents
CREATE POLICY "System can insert source documents" ON source_documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM draft_documents 
            WHERE id = source_documents.draft_document_id 
            AND organization_id = get_user_organization_id()
        )
    );

-- Approved documents policies
-- Users can view approved documents in their organization
CREATE POLICY "Users can view approved documents in their organization" ON approved_documents
    FOR SELECT USING (organization_id = get_user_organization_id());

-- Managers can insert approved documents
CREATE POLICY "Managers can insert approved documents" ON approved_documents
    FOR INSERT WITH CHECK (organization_id = get_user_organization_id() AND is_manager());

-- Managers can update approved documents
CREATE POLICY "Managers can update approved documents" ON approved_documents
    FOR UPDATE USING (organization_id = get_user_organization_id() AND is_manager());

-- Document versions policies
-- Users can view document versions for documents in their organization
CREATE POLICY "Users can view document versions in their organization" ON document_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM approved_documents 
            WHERE id = document_versions.document_id 
            AND organization_id = get_user_organization_id()
        )
    );

-- Managers can insert document versions
CREATE POLICY "Managers can insert document versions" ON document_versions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM approved_documents 
            WHERE id = document_versions.document_id 
            AND organization_id = get_user_organization_id()
        ) AND is_manager()
    );

-- Document chunks policies
-- Users can view document chunks in their organization
CREATE POLICY "Users can view document chunks in their organization" ON document_chunks
    FOR SELECT USING (organization_id = get_user_organization_id());

-- System can manage document chunks
CREATE POLICY "System can insert document chunks" ON document_chunks
    FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "System can update document chunks" ON document_chunks
    FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "System can delete document chunks" ON document_chunks
    FOR DELETE USING (organization_id = get_user_organization_id());

-- Q&A interactions policies
-- Users can view their own Q&A interactions
CREATE POLICY "Users can view their own QA interactions" ON qa_interactions
    FOR SELECT USING (user_id = auth.uid());

-- Managers can view all Q&A interactions in their organization
CREATE POLICY "Managers can view all QA interactions in their organization" ON qa_interactions
    FOR SELECT USING (organization_id = get_user_organization_id() AND is_manager());

-- Users can insert their own Q&A interactions
CREATE POLICY "Users can insert their own QA interactions" ON qa_interactions
    FOR INSERT WITH CHECK (user_id = auth.uid() AND organization_id = get_user_organization_id());

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for the service role (for system operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;