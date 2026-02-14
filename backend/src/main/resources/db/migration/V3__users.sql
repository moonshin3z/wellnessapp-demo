

ALTER TABLE assessment_results
  DROP CONSTRAINT IF EXISTS fk_results_user,
  ADD CONSTRAINT fk_results_user
    FOREIGN KEY (user_id) REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
