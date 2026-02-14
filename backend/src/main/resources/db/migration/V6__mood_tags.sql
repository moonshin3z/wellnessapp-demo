-- Add tags column to mood_entries for quick mood tagging
-- Stores comma-separated tag IDs (e.g., "sleep,exercise,social")
ALTER TABLE mood_entries ADD COLUMN IF NOT EXISTS tags VARCHAR(200);
