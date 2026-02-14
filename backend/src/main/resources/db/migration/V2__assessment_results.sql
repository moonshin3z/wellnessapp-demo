CREATE TABLE IF NOT EXISTS assessment_results (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  assessment_type TEXT NOT NULL,           
  total INT NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  user_id BIGINT
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_assessment_results_created_at ON assessment_results (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user ON assessment_results (user_id);
