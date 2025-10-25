-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom types
CREATE TYPE user_role AS ENUM ('manager', 'employee');
CREATE TYPE source_type AS ENUM ('teams', 'google_drive');
CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE triage_level AS ENUM ('green', 'yellow', 'red');

-- Organizations table (for multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'employee',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connected sources table
CREATE TABLE connected_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type source_type NOT NULL,
    name TEXT NOT NULL,
    access_token TEXT NOT NULL, -- Encrypted in application layer
    refresh_token TEXT NOT NULL, -- Encrypted in application layer
    selected_channels TEXT[], -- For Teams integration
    selected_folders TEXT[], -- For Google Drive integration
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft documents table (approval queue)
CREATE TABLE draft_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    triage_level triage_level NOT NULL,
    status document_status DEFAULT 'pending',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source documents table (links draft documents to their sources)
CREATE TABLE source_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_document_id UUID NOT NULL REFERENCES draft_documents(id) ON DELETE CASCADE,
    source_type source_type NOT NULL,
    source_id TEXT NOT NULL, -- External ID from Teams/Drive
    original_content TEXT NOT NULL,
    redacted_content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approved documents table (knowledge base)
CREATE TABLE approved_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by UUID NOT NULL REFERENCES users(id),
    version INTEGER DEFAULT 1,
    embedding vector(1536) -- OpenAI ada-002 embedding dimension
);

-- Document versions table (version history)
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES approved_documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    changes TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES users(id),
    approved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks table (for RAG system)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES approved_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Q&A interactions table (for analytics)
CREATE TABLE qa_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    sources JSONB DEFAULT '[]',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_connected_sources_user_id ON connected_sources(user_id);
CREATE INDEX idx_connected_sources_type ON connected_sources(type);
CREATE INDEX idx_draft_documents_organization_id ON draft_documents(organization_id);
CREATE INDEX idx_draft_documents_status ON draft_documents(status);
CREATE INDEX idx_draft_documents_triage_level ON draft_documents(triage_level);
CREATE INDEX idx_source_documents_draft_document_id ON source_documents(draft_document_id);
CREATE INDEX idx_approved_documents_organization_id ON approved_documents(organization_id);
CREATE INDEX idx_approved_documents_tags ON approved_documents USING GIN(tags);
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_organization_id ON document_chunks(organization_id);
CREATE INDEX idx_qa_interactions_user_id ON qa_interactions(user_id);
CREATE INDEX idx_qa_interactions_organization_id ON qa_interactions(organization_id);

-- Vector similarity search index
CREATE INDEX idx_approved_documents_embedding ON approved_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_connected_sources_updated_at BEFORE UPDATE ON connected_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_draft_documents_updated_at BEFORE UPDATE ON draft_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_approved_documents_updated_at BEFORE UPDATE ON approved_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();