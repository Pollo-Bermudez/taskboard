-- 002: el login compara lower(correo); la unicidad debe ser igual de insensible a mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_correo_lower_key ON usuarios (lower(correo));
