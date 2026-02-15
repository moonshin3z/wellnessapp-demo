-- Recreate mood_entries with proper schema (replaces V1 definition)
DROP TABLE IF EXISTS mood_entries;

CREATE TABLE mood_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood_score INT NOT NULL CHECK (mood_score >= 1 AND mood_score <= 5),
    mood_emoji VARCHAR(10),
    notes VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_id ON mood_entries(user_id);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_mood_entries_created_at ON mood_entries(created_at DESC);

-- Composite index for user + date queries
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_date ON mood_entries(user_id, created_at DESC);
