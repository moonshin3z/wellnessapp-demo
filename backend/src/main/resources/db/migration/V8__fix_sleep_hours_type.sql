-- Fix sleep_hours column type from DECIMAL to DOUBLE PRECISION
ALTER TABLE mood_entries ALTER COLUMN sleep_hours TYPE DOUBLE PRECISION;
