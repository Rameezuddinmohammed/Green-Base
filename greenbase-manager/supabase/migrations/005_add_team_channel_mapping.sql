-- Migration: Add team-channel mapping for Microsoft Teams integration
-- This ensures we can retrieve messages by storing both teamId and channelId

-- Add a new column to store team-channel mappings as JSONB
-- Format: [{"teamId": "team123", "channelId": "channel456", "displayName": "Team - Channel"}]
ALTER TABLE connected_sources 
ADD COLUMN selected_team_channels JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the structure
COMMENT ON COLUMN connected_sources.selected_team_channels IS 'Stores team-channel mappings for Microsoft Teams. Format: [{"teamId": "string", "channelId": "string", "displayName": "string"}]';

-- Create index for efficient querying of team-channel data
CREATE INDEX IF NOT EXISTS idx_connected_sources_team_channels 
ON connected_sources USING GIN (selected_team_channels);