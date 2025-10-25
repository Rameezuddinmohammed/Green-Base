-- Function to search documents using vector similarity
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
    org_id uuid;
BEGIN
    -- Use provided organization_id or get from current user
    IF organization_id IS NULL THEN
        org_id := get_user_organization_id();
    ELSE
        org_id := organization_id;
    END IF;

    RETURN QUERY
    SELECT
        approved_documents.id,
        approved_documents.title,
        approved_documents.content,
        1 - (approved_documents.embedding <=> query_embedding) AS similarity
    FROM approved_documents
    WHERE approved_documents.organization_id = org_id
        AND approved_documents.embedding IS NOT NULL
        AND 1 - (approved_documents.embedding <=> query_embedding) > match_threshold
    ORDER BY approved_documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to search document chunks using vector similarity
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 20,
    organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    similarity float,
    document_title text
)
LANGUAGE plpgsql
AS $$
DECLARE
    org_id uuid;
BEGIN
    -- Use provided organization_id or get from current user
    IF organization_id IS NULL THEN
        org_id := get_user_organization_id();
    ELSE
        org_id := organization_id;
    END IF;

    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity,
        ad.title AS document_title
    FROM document_chunks dc
    JOIN approved_documents ad ON dc.document_id = ad.id
    WHERE dc.organization_id = org_id
        AND dc.embedding IS NOT NULL
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to get document statistics for an organization
CREATE OR REPLACE FUNCTION get_document_stats(org_id uuid DEFAULT NULL)
RETURNS TABLE (
    total_approved_documents bigint,
    total_draft_documents bigint,
    pending_approvals bigint,
    total_qa_interactions bigint,
    avg_confidence_score numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
    target_org_id uuid;
BEGIN
    -- Use provided org_id or get from current user
    IF org_id IS NULL THEN
        target_org_id := get_user_organization_id();
    ELSE
        target_org_id := org_id;
    END IF;

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM approved_documents WHERE organization_id = target_org_id),
        (SELECT COUNT(*) FROM draft_documents WHERE organization_id = target_org_id),
        (SELECT COUNT(*) FROM draft_documents WHERE organization_id = target_org_id AND status = 'pending'),
        (SELECT COUNT(*) FROM qa_interactions WHERE organization_id = target_org_id),
        (SELECT AVG(confidence_score) FROM draft_documents WHERE organization_id = target_org_id);
END;
$$;

-- Function to update document embeddings (for batch operations)
CREATE OR REPLACE FUNCTION update_document_embedding(
    doc_id uuid,
    new_embedding vector(1536)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE approved_documents 
    SET embedding = new_embedding
    WHERE id = doc_id
        AND organization_id = get_user_organization_id();
END;
$$;

-- Function to create document chunks with embeddings
CREATE OR REPLACE FUNCTION create_document_chunks(
    doc_id uuid,
    chunks_data jsonb -- Array of {content: string, embedding: vector}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    chunk_item jsonb;
    chunk_index int := 0;
    org_id uuid;
BEGIN
    -- Get organization ID from the document
    SELECT organization_id INTO org_id
    FROM approved_documents
    WHERE id = doc_id;

    -- Delete existing chunks for this document
    DELETE FROM document_chunks WHERE document_id = doc_id;

    -- Insert new chunks
    FOR chunk_item IN SELECT * FROM jsonb_array_elements(chunks_data)
    LOOP
        INSERT INTO document_chunks (
            document_id,
            chunk_index,
            content,
            embedding,
            organization_id
        ) VALUES (
            doc_id,
            chunk_index,
            chunk_item->>'content',
            (chunk_item->>'embedding')::vector(1536),
            org_id
        );
        
        chunk_index := chunk_index + 1;
    END LOOP;
END;
$$;

-- Function to search across both documents and chunks
CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    organization_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    similarity float,
    source_type text -- 'document' or 'chunk'
)
LANGUAGE plpgsql
AS $$
DECLARE
    org_id uuid;
BEGIN
    -- Use provided organization_id or get from current user
    IF organization_id IS NULL THEN
        org_id := get_user_organization_id();
    ELSE
        org_id := organization_id;
    END IF;

    RETURN QUERY
    (
        -- Search full documents
        SELECT
            ad.id,
            ad.title,
            ad.content,
            1 - (ad.embedding <=> query_embedding) AS similarity,
            'document'::text AS source_type
        FROM approved_documents ad
        WHERE ad.organization_id = org_id
            AND ad.embedding IS NOT NULL
            AND 1 - (ad.embedding <=> query_embedding) > match_threshold
        
        UNION ALL
        
        -- Search document chunks
        SELECT
            dc.document_id AS id,
            ad.title,
            dc.content,
            1 - (dc.embedding <=> query_embedding) AS similarity,
            'chunk'::text AS source_type
        FROM document_chunks dc
        JOIN approved_documents ad ON dc.document_id = ad.id
        WHERE dc.organization_id = org_id
            AND dc.embedding IS NOT NULL
            AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    )
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;