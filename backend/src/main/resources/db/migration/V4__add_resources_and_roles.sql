-- 1) Agregar rol a users (idempotente)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'USER';

-- Restringir valores permitidos para role (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role_valid'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_role_valid
      CHECK (role IN ('USER','ADMIN'));
  END IF;
END$$;

-- 2) Tabla de recursos
CREATE TABLE IF NOT EXISTS resources (
  id                  BIGSERIAL PRIMARY KEY,
  title               VARCHAR(200) NOT NULL,
  category            VARCHAR(80)  NOT NULL,
  emoji               VARCHAR(8),
  description         TEXT,
  content_json        JSONB,
  status              VARCHAR(16)  NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  created_by_user_id  BIGINT,                                    -- V4 original
  created_by          BIGINT,                                    -- legacy
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
  is_public           BOOLEAN      NOT NULL DEFAULT TRUE,        -- legacy
  file_url            TEXT,                                       -- legacy
  file_key            TEXT,                                       -- legacy
  CONSTRAINT fk_resources_user_v4
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_resources_created_by
    FOREIGN KEY (created_by)         REFERENCES users(id) ON DELETE RESTRICT
);

-- Validar estados permitidos (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_resources_status_valid'
  ) THEN
    ALTER TABLE resources
      ADD CONSTRAINT chk_resources_status_valid
      CHECK (status IN ('PENDING','APPROVED','REJECTED'));
  END IF;
END$$;

-- (Opcional) Mantener coherencia entre created_by y created_by_user_id
-- Si uno viene nulo, permitir; si se llena created_by, debe coincidir con created_by_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_resources_created_by_consistency'
  ) THEN
    ALTER TABLE resources
      ADD CONSTRAINT chk_resources_created_by_consistency
      CHECK (
        created_by IS NULL
        OR created_by_user_id IS NULL
        OR created_by = created_by_user_id
      );
  END IF;
END$$;

-- 3) Archivos asociados a recursos 
CREATE TABLE IF NOT EXISTS resource_files (
  id          BIGSERIAL PRIMARY KEY,
  file_name   VARCHAR(255) NOT NULL,
  file_url    VARCHAR(512) NOT NULL,
  resource_id BIGINT       NOT NULL,
  CONSTRAINT fk_resource_files_resource
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

-- 4) Favoritos de recursos (por usuario) (V4 original)
CREATE TABLE IF NOT EXISTS resource_favorites (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  resource_id BIGINT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_favs_user
    FOREIGN KEY (user_id)     REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_favs_resource
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT uq_user_resource UNIQUE (user_id, resource_id)
);

-- 5) Índices útiles (incluye los legacy)
CREATE INDEX IF NOT EXISTS idx_resources_status        ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_category      ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_created_by_id ON resources(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_resources_created_by    ON resources(created_by);
CREATE INDEX IF NOT EXISTS idx_resources_is_public     ON resources(is_public);
CREATE INDEX IF NOT EXISTS idx_resources_created_at    ON resources(created_at DESC);


UPDATE users SET role = 'ADMIN' WHERE email = 'ivanroblerom@gmail.com';