-- 003: límite de intentos de login por correo, compartido entre todas las réplicas del backend.
CREATE TABLE IF NOT EXISTS login_intentos (
    correo VARCHAR(150) PRIMARY KEY,
    fallos INTEGER NOT NULL DEFAULT 0,
    primer_fallo TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bloqueado_hasta TIMESTAMP WITH TIME ZONE
);
