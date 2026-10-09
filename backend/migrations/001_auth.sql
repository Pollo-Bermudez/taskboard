-- 001: soporte de autenticación, actualizado_en automático y nombres de equipo únicos.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    familia UUID NOT NULL,
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    revocado_en TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_familia ON refresh_tokens(familia);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuario_id);

CREATE OR REPLACE FUNCTION set_actualizado_en() RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tareas_actualizado_en ON tareas;
CREATE TRIGGER trg_tareas_actualizado_en
    BEFORE UPDATE ON tareas
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipos_nombre_key') THEN
        ALTER TABLE equipos ADD CONSTRAINT equipos_nombre_key UNIQUE (nombre);
    END IF;
END $$;
