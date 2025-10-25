-- Migration: Remove OAuth tokens from connected_sources table
-- SECURITY: OAuth tokens must be stored in Azure Key Vault only, never in database

-- Remove access_token and refresh_token columns from connected_sources table
ALTER TABLE connected_sources 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

-- Add comment to document security requirement
COMMENT ON TABLE connected_sources IS 'Stores OAuth source metadata only. Access and refresh tokens are stored securely in Azure Key Vault.';