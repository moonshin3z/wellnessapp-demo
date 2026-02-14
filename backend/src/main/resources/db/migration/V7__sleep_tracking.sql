-- Add sleep tracking fields to mood_entries
ALTER TABLE mood_entries ADD COLUMN IF NOT EXISTS sleep_hours DOUBLE PRECISION;
ALTER TABLE mood_entries ADD COLUMN IF NOT EXISTS sleep_quality INT CHECK (sleep_quality IS NULL OR (sleep_quality >= 1 AND sleep_quality <= 5));
